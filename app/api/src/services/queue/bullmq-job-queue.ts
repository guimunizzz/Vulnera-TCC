/**
 * bullmq-job-queue.ts
 *
 * Motor `bullmq` (ADR-056): filas persistentes no Redis.
 *
 * Duas conexões com perfis diferentes, como pede o guia "Going to production"
 * do BullMQ (https://docs.bullmq.io/guide/going-to-production):
 *   - produtor (Queue): falha em vez de esperar para sempre quando o Redis cai,
 *     para a requisição HTTP devolver erro e não pendurar;
 *   - worker: `maxRetriesPerRequest: null`, para continuar consumindo depois
 *     que o Redis voltar.
 *
 * O Redis do compose exige senha e não publica porta (ADR-056, Infra); a URL
 * vem de `REDIS_URL` e nunca é logada (leva a senha).
 */

import { Queue, type ConnectionOptions, type JobsOptions } from "bullmq";
import { QUEUE_NAMES, type JobQueue, type QueueName, type ThreatIntelJobData } from "./job-queue";

const TIMEOUT_VERIFICACAO_MS = 5_000;

/**
 * Opções dos jobs da Threat Intel (ADR-056 §5). O processor só lança erro —
 * e só então há retry — quando a execução inteira cai por causa transitória
 * (todas as fontes fora, banco/rede); fonte que falha sozinha já vira PARTIAL
 * dentro da execução e espera a próxima. Backoff de 1 min, 2 min: o NVD
 * limitando (429) não se resolve em segundos.
 *
 * Falhas ficam retidas (o equivalente a uma DLQ): as 50 últimas, consultáveis
 * no Redis; cada tentativa também deixa o seu ThreatSyncRun FAILED no banco.
 */
export const OPCOES_JOB_THREAT_INTEL: JobsOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 60_000 },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 50 },
};

export function conexaoProdutor(redisUrl: string): ConnectionOptions {
  return { url: redisUrl, maxRetriesPerRequest: 3 };
}

export function conexaoWorker(redisUrl: string): ConnectionOptions {
  return { url: redisUrl, maxRetriesPerRequest: null };
}

export class BullmqJobQueue implements JobQueue {
  readonly driver = "bullmq" as const;
  private readonly filas = new Map<QueueName, Queue>();
  private fechada = false;

  constructor(private readonly redisUrl: string) {}

  /** Fila do produtor, criada sob demanda e reaproveitada (uma conexão por fila). */
  fila(nome: QueueName): Queue {
    if (this.fechada) throw new Error("JOB_QUEUE_CLOSED");
    let fila = this.filas.get(nome);
    if (!fila) {
      fila = new Queue(nome, { connection: conexaoProdutor(this.redisUrl) });
      // Sem listener, um erro de conexão vira "unhandled error event" e derruba o processo.
      fila.on("error", (err) => console.error(`[fila] ${nome}: ${err.message}`));
      this.filas.set(nome, fila);
    }
    return fila;
  }

  /** Conexão para os Workers do `worker.ts` (perfil de consumidor). */
  conexaoParaWorkers(): ConnectionOptions {
    return conexaoWorker(this.redisUrl);
  }

  async enfileirarThreatIntel(dados: ThreatIntelJobData): Promise<void> {
    await this.fila(QUEUE_NAMES.threatIntel).add(dados.trigger === "ASSET" ? "backfill" : "sync", dados, OPCOES_JOB_THREAT_INTEL);
  }

  async threatIntelEmAndamento(): Promise<boolean> {
    // Sem "delayed": o scheduler sempre mantém um job delayed esperando a
    // próxima janela (https://docs.bullmq.io/guide/job-schedulers), e isso não
    // é "sincronizando". Retry em backoff também fica de fora — honesto o
    // bastante para o selo da tela.
    const c = await this.fila(QUEUE_NAMES.threatIntel).getJobCounts("active", "waiting", "prioritized");
    return (c.active ?? 0) + (c.waiting ?? 0) + (c.prioritized ?? 0) > 0;
  }

  async verificarConexao(): Promise<void> {
    const fila = this.fila(QUEUE_NAMES.dastScan);
    let timer: NodeJS.Timeout | undefined;
    const limite = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Redis não respondeu em ${TIMEOUT_VERIFICACAO_MS / 1000}s`)), TIMEOUT_VERIFICACAO_MS);
    });
    try {
      // waitUntilReady prova o socket; getJobCounts prova a senha (comando real).
      await Promise.race([fila.waitUntilReady().then(() => fila.getJobCounts()), limite]);
    } finally {
      clearTimeout(timer);
    }
  }

  async close(): Promise<void> {
    if (this.fechada) return;
    this.fechada = true;
    await Promise.allSettled([...this.filas.values()].map((f) => f.close()));
    this.filas.clear();
  }
}
