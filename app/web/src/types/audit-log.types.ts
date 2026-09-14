/**
 * audit-log.types.ts
 *
 * Espelha `AuditLogResponseDTO` do backend (app/api/src/models/audit-log.model.ts).
 * Usado pela trilha de auditoria na página de detalhe do finding.
 */

/**
 * Ações que a trilha de um finding registra hoje.
 *
 * `string` no fim de propósito: a trilha é append-only e histórica, então ela
 * pode conter ações gravadas por versões anteriores do sistema que o código
 * atual não conhece mais. Um `Record` fechado quebraria a página por causa de
 * uma linha antiga — a tela mostra a ação crua quando não reconhece.
 */
export const ACOES_CONHECIDAS = [
  "CREATE",
  "UPDATE",
  "DELETE",
  "STATUS_CHANGE",
  "SEVERITY_CHANGE",
  "SEVERITY_OVERRIDE",
  "SEVERITY_OVERRIDE_RESET",
] as const;

export type AuditAction = string;

export interface AuditLogEntry {
  id: string;
  action: AuditAction;
  actorId: string;
  actorName: string;
  /** Já desserializado pelo backend. `null` quando o evento não guardou diff. */
  diff: unknown;
  createdAt: string;
}
