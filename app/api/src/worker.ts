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
 * Workers registrados: Threat Intel (Fase 3) e DAST (Fase 4). Agendamentos
 * (Fase 5) entram aqui.
 *
 * Quem executa é quem recupera: no motor bullmq, a reconciliação de boot do
 * DAST (RUNNING órfão vira FAILED, QUEUED sobrevive) roda AQUI, antes de
 * consumir — não no server.ts. Com o worker em processo próprio, um restart
 * da API não pode marcar como FAILED um scan que o worker continua rodando.
 */

import type { Worker } from "bullmq";
import { EnvVar } from "./config/EnvVar";
import { EnvKeys } from "./config/enum/EnvKeys";
import { makeJobQueue } from "./factories/job-queue.factory";
import { makeThreatIntelSyncService } from "./factories/threat-intel.factory";
import { makeDastScanService } from "./factories/dast-scan.factory";
import { dastWatchdog } from "./services/dast-watchdog.service";
import { iniciarWorkerDast } from "./services/queue/workers/dast-scan.worker";
import { BullmqJobQueue } from "./services/queue/bullmq-job-queue";
import { QUEUE_NAMES, type JobQueue } from "./services/queue/job-queue";
import { iniciarWorkerThreatIntel } from "./services/queue/workers/threat-intel.worker";

export interface WorkersEmExecucao {
  /** Fecha os workers (espera o job em andamento) e as conexões da fila. */
  encerrar(): Promise<void>;
}

export async function iniciarWorkers(fila: JobQueue): Promise<WorkersEmExecucao> {
  if (fila.driver !== "bullmq" || !(fila instanceof BullmqJobQueue)) {
    throw new Error("Workers só existem com QUEUE_DRIVER=bullmq; com memory a fila roda no próprio processo da API.");
  }
  await fila.verificarConexao();
  console.log("🧵 Fila bullmq: conectada ao Redis.");

  const workers: Worker[] = [];
  workers.push(
    await iniciarWorkerThreatIntel(fila.conexaoParaWorkers(), fila.fila(QUEUE_NAMES.threatIntel), makeThreatIntelSyncService(), {
      habilitado: EnvVar.getOptional(EnvKeys.THREAT_INTEL_SYNC_ENABLED, "true") !== "false",
      intervaloMin: Number(EnvVar.getOptional(EnvKeys.THREAT_INTEL_SYNC_INTERVAL_MIN, "360")) || 360,
    }),
  );

  // DAST: reconcilia banco × Redis ANTES de consumir (senão o worker pegaria
  // um job cujo scan o boot ainda vai declarar órfão).
  const dast = makeDastScanService();
  const r = await dast.recuperarParaFila((scanId) => fila.garantirDastScanNaFila(scanId));
  console.log(`🧵 DAST: ${r.naFila} scan(s) na fila preservado(s) (${r.reenfileirados} reenfileirado(s)), ${r.falhados} em execução marcado(s) como FAILED`);
  workers.push(iniciarWorkerDast(fila.conexaoParaWorkers(), dast, dastWatchdog.maxConcurrent));

  return {
    encerrar: async () => {
      // Worker.close() espera o job em andamento terminar antes de soltar.
      await Promise.allSettled(workers.map((w) => w.close()));
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
