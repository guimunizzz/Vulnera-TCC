/**
 * queue-admin.types.ts — painel de filas do ADMIN (ADR-056).
 * Espelha `GET /api/admin/queues`. `data` do job vem serializado e cortado
 * em 500 caracteres pela API; a tela só mostra, nunca interpreta.
 */

export interface ContagensFila {
  waiting: number;
  active: number;
  delayed: number;
  completed: number;
  failed: number;
}

export interface JobFalhoPainel {
  id: string;
  name: string;
  failedReason: string;
  attemptsMade: number;
  /** ISO 8601 ou null quando o job não chegou a terminar. */
  finishedOn: string | null;
  data: string;
}

export interface FilaPainel {
  name: string;
  label: string;
  counts: ContagensFila;
  failed: JobFalhoPainel[];
}

export interface PainelFilas {
  /** memory: não há fila persistente, `queues` vem vazio. */
  driver: "memory" | "bullmq";
  queues: FilaPainel[];
}

export interface JobReprocessado {
  fila: string;
  jobId: string;
}
