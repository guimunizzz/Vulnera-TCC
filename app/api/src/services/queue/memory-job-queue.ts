/**
 * memory-job-queue.ts
 *
 * Motor `memory` (ADR-056): não guarda nada novo. A fila DAST continua no
 * watchdog (`dast-watchdog.service.ts`) e a Threat Intel no `agendador.ts`,
 * exatamente como antes do ADR-056 — é o caminho de rollback e o padrão até a
 * fila DAST no BullMQ ser aprovada (Fase 4).
 */

import type { JobQueue } from "./job-queue";

export class MemoryJobQueue implements JobQueue {
  readonly driver = "memory" as const;

  async verificarConexao(): Promise<void> {
    // Nada externo para alcançar: a fila vive no próprio processo.
  }

  async close(): Promise<void> {
    // Sem conexões abertas.
  }
}
