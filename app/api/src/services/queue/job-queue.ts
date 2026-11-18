/**
 * job-queue.ts
 *
 * Contrato pequeno da fila de jobs do Vulnera (ADR-056). Dois motores,
 * escolhidos por `QUEUE_DRIVER` na factory (`factories/job-queue.factory.ts`):
 *
 *   - memory: o comportamento de sempre — fila DAST no watchdog em memória
 *     (ADR-031) e `setInterval` da Threat Intel (ADR-053). É o padrão e o
 *     caminho de rollback.
 *   - bullmq: fila persistente no Redis, consumida por `src/worker.ts`.
 *
 * O contrato cresce fase a fase, só com o que os dois motores implementam de
 * verdade (sem método que um deles não saiba cumprir): a Fase 2 entrega o
 * motor e a conexão; Threat Intel (Fase 3), DAST (Fase 4) e agendamentos
 * (Fase 5) entram depois.
 *
 * Regra de payload (ADR-056 §3): jobs levam SÓ ids. O worker recarrega tudo
 * do banco — nada de URL, token ou segredo no Redis.
 */

export type QueueDriver = "memory" | "bullmq";

/** Nomes das filas no Redis, um por assunto (ADR-056 §1). */
export const QUEUE_NAMES = {
  dastScan: "dast-scan",
  threatIntel: "threat-intel",
  dastSchedule: "dast-schedule",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export interface JobQueue {
  readonly driver: QueueDriver;
  /**
   * Prova que o motor está utilizável. memory: nada a provar. bullmq: uma ida
   * e volta autenticada ao Redis — rejeita com a causa (senha errada, Redis
   * fora do ar) em vez de ficar tentando para sempre em silêncio.
   */
  verificarConexao(): Promise<void>;
  /** Fecha conexões. Idempotente. */
  close(): Promise<void>;
}

/** Lê o driver; valor desconhecido é erro de configuração, não silêncio. */
export function parseQueueDriver(raw: string | undefined): QueueDriver {
  const value = (raw ?? "").trim().toLowerCase();
  if (value === "" || value === "memory") return "memory";
  if (value === "bullmq") return "bullmq";
  throw new Error(`QUEUE_DRIVER inválido: "${raw}". Use "memory" ou "bullmq".`);
}
