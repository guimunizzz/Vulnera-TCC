/**
 * audit-log.model.ts
 *
 * Tipos do domínio AuditLog — trilha de ações sensíveis (append-only).
 * Consumido pelos services que precisam registrar uma ação auditável
 * (ex: SubscriptionService em request/approve/reject).
 *
 * diffJson é String (não Json) porque é assim que está definido em
 * schema.prisma — quem grava serializa com JSON.stringify antes.
 */

import type { AuditLog as PrismaAuditLog } from "@prisma/client";

export type AuditLog = PrismaAuditLog;

export type CreateAuditLogDTO = {
  actorId: string;
  companyId?: string | null;
  entityType: string;
  entityId: string;
  action: string;
  diffJson?: string | null;
};
