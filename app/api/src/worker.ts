/**
 * worker.ts
 *
 * Entrypoint dos workers da fila (ADR-056 §3). Dois jeitos de rodar, o mesmo
 * código:
 *
 *   1. Dentro da API (padrão): o server.ts chama `iniciarWorkers()` quando
 *      QUEUE_DRIVER=bullmq e WORKER_IN_PROCESS não é "false".
 *   2. Processo próprio: `npm run worker` (WORKER_IN_PROCESS=false na API).
 *      Separar o worker no futuro é só mudança de compose, não de código.
 *
 * O app.ts NUNCA importa este arquivo: os testes importam o app e não podem
 * abrir conexão com o Redis (A6).
 *
 * Fase 2: o motor conecta e encerra limpo, mas ainda NÃO consome job nenhum.
 * Threat Intel (Fase 3), DAST (Fase 4) e agendamentos (Fase 5) registram aqui
 * os seus Workers. Até lá, com QUEUE_DRIVER=bullmq, o DAST e a Threat Intel
 * continuam no motor em memória — o boot avisa isso no log.
 */

import { makeJobQueue } from "./factories/job-queue.factory";
import type { JobQueue } from "./services/queue/job-queue";

export interface WorkersEmExecucao {
  /** Fecha os workers (espera o job em andamento) e as conexões da fila. */
  encerrar(): Promise<void>;
}

export async function iniciarWorkers(fila: JobQueue): Promise<WorkersEmExecucao> {
  if (fila.driver !== "bullmq") {
    throw new Error("Workers só existem com QUEUE_DRIVER=bullmq; com memory a fila roda no próprio processo da API.");
  }
  await fila.verificarConexao();
  console.log("🧵 Fila bullmq: conectada ao Redis. Nenhum worker registrado ainda (DAST e Threat Intel seguem no motor em memória até as Fases 3 e 4).");

  return {
    encerrar: async () => {
      await fila.close();
    },
  };
}

/**
 * Encerramento limpo em SIGINT/SIGTERM (guia "Going to production" do
 * BullMQ). Usado pelo worker em processo próprio e pelo server.ts quando o
 * worker roda dentro da API.
 */
export function encerrarAoReceberSinal(encerrar: () => Promise<void>): void {
  let encerrando = false;
  const aoSinal = (sinal: NodeJS.Signals) => {
    if (encerrando) return;
    encerrando = true;
    console.log(`🧵 ${sinal} recebido: encerrando a fila...`);
    encerrar()
      .catch((err) => console.error("Falha ao encerrar a fila", err))
      .finally(() => process.exit(0));
  };
  process.once("SIGINT", aoSinal);
  process.once("SIGTERM", aoSinal);
}

// `npm run worker`: este arquivo é o processo.
if (require.main === module) {
  const fila = makeJobQueue();
  iniciarWorkers(fila)
    .then((workers) => encerrarAoReceberSinal(() => workers.encerrar()))
    .catch((err: Error) => {
      console.error(`🧵 Worker não iniciou: ${err.message}`);
      void fila.close().finally(() => process.exit(1));
    });
}
