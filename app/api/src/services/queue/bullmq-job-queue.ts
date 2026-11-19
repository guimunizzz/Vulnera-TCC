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
import { reconciliarAgendamentosDast } from "./workers/dast-schedule.worker";
import { QUEUE_NAMES, type AgendamentoDastDesejado, type DastScanJobData, type JobQueue, type PedidoScanDast, type QueueName, type ScanNaFila, type ThreatIntelJobData } from "./job-queue";

const TIMEOUT_VERIFICACAO_MS = 5_000;
const TIMEOUT_ENFILEIRAR_MS = 5_000;

/** Rejeita se a promessa não resolver no prazo (sem cancelá-la). */
async function comPrazo<T>(promessa: Promise<T>, ms: number, motivo: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const limite = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${motivo} em ${ms / 1000}s`)), ms);
  });
  try {
    return await Promise.race([promessa, limite]);
  } finally {
    clearTimeout(timer);
  }
}

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

/**
 * Opções dos jobs DAST (ADR-056 §4). `attempts: 1` de propósito: um retry
 * automático dispararia de novo um scan ativo contra o alvo sem decisão
 * humana (ADR-042), e a guarda "só roda se QUEUED" já o anularia. Falha vira
 * FAILED visível; o pentester decide se tenta de novo.
 */
export const OPCOES_JOB_DAST: JobsOptions = {
  attempts: 1,
  removeOnComplete: { count: 200 },
  removeOnFail: { count: 200 },
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

  constructor(
    private readonly redisUrl: string,
    /** Limite de scans simultâneos — o mesmo número que vira a concorrência do worker DAST. */
    readonly maxConcurrentDast = 1,
  ) {}

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

  async enfileirarDastScan(pedido: PedidoScanDast): Promise<number> {
    const fila = this.fila(QUEUE_NAMES.dastScan);
    const dados: DastScanJobData = { scanId: pedido.scanId };
    // Redis fora do ar: o ioredis reconecta por ~30 s antes de desistir, tempo
    // demais para uma requisição HTTP. Desiste em 5 s; se o Redis voltar
    // depois, o job entra mesmo assim — coerente com o scan já QUEUED no banco.
    await comPrazo(fila.add("scan", dados, { ...OPCOES_JOB_DAST, jobId: pedido.scanId }), TIMEOUT_ENFILEIRAR_MS, "fila DAST não respondeu");
    // Posição aproximada para o aviso da tela: se há vaga, começa agora (0).
    const { active = 0 } = await fila.getJobCounts("active");
    if (active < this.maxConcurrentDast) return 0;
    const posicao = (await this.dastNaFila()).findIndex((s) => s.scanId === pedido.scanId);
    return posicao === -1 ? 0 : posicao + 1;
  }

  async removerDastScanDaFila(scanId: string): Promise<boolean> {
    const job = await this.fila(QUEUE_NAMES.dastScan).getJob(scanId);
    if (!job) return false;
    try {
      // Job ativo (travado pelo worker) não sai: o BullMQ lança. Quem o para é o abort + docker rm -f.
      await job.remove();
      return true;
    } catch {
      return false;
    }
  }

  async dastNaFila(): Promise<ScanNaFila[]> {
    const jobs = await this.fila(QUEUE_NAMES.dastScan).getJobs(["waiting", "prioritized"], 0, -1);
    return jobs
      .filter((j) => !!j?.id)
      .sort((a, b) => a.timestamp - b.timestamp)
      .map((j) => ({ scanId: String(j.id), queuedAt: new Date(j.timestamp).toISOString() }));
  }

  /**
   * Boot do worker (ADR-056 §4): o MySQL é a fonte da verdade. Um scan QUEUED
   * sem job vivo no Redis (Redis apagado, job perdido) volta para a fila com o
   * mesmo jobId. Devolve true se precisou reenfileirar.
   */
  async garantirDastScanNaFila(scanId: string): Promise<boolean> {
    const fila = this.fila(QUEUE_NAMES.dastScan);
    const job = await fila.getJob(scanId);
    if (job) {
      const estado = await job.getState();
      if (["waiting", "delayed", "prioritized", "active", "waiting-children"].includes(estado)) return false;
      // completed/failed com o scan ainda QUEUED: resto de outra vida. Limpa e reenfileira.
      await job.remove().catch(() => undefined);
    }
    await fila.add("scan", { scanId } satisfies DastScanJobData, { ...OPCOES_JOB_DAST, jobId: scanId });
    return true;
  }

  async proximasExecucoesDast(): Promise<Map<string, string>> {
    const schedulers = await this.fila(QUEUE_NAMES.dastSchedule).getJobSchedulers(0, -1, true);
    const proximas = new Map<string, string>();
    for (const s of schedulers) {
      const id = typeof s.key === "string" && s.key.startsWith("dast-schedule:") ? s.key.slice("dast-schedule:".length) : null;
      if (id && typeof s.next === "number") proximas.set(id, new Date(s.next).toISOString());
    }
    return proximas;
  }

  async aplicarAgendamentosDast(desejados: AgendamentoDastDesejado[]): Promise<{ upserts: number; removidos: number }> {
    return reconciliarAgendamentosDast(this.fila(QUEUE_NAMES.dastSchedule), desejados);
  }

  async verificarConexao(): Promise<void> {
    const fila = this.fila(QUEUE_NAMES.dastScan);
    // waitUntilReady prova o socket; getJobCounts prova a senha (comando real).
    await comPrazo(
      fila.waitUntilReady().then(() => fila.getJobCounts()),
      TIMEOUT_VERIFICACAO_MS,
      "Redis não respondeu",
    );
  }

  async close(): Promise<void> {
    if (this.fechada) return;
    this.fechada = true;
    await Promise.allSettled([...this.filas.values()].map((f) => f.close()));
    this.filas.clear();
  }
}
