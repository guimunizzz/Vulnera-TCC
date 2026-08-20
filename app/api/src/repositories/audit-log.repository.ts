/**
 * audit-log.repository.ts
 *
 * Acesso a dados do AuditLog. Append-only por design: só existe create(),
 * nunca update/delete — trilha de auditoria não pode ser alterada depois
 * de gravada.
 */

import type { PrismaClient } from "@prisma/client";
import type { AuditLog, CreateAuditLogDTO } from "../models/audit-log.model";

export class AuditLogRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CreateAuditLogDTO): Promise<AuditLog> {
    return this.prisma.auditLog.create({
      data: {
        actorId: data.actorId,
        companyId: data.companyId ?? null,
        entityType: data.entityType,
        entityId: data.entityId,
        action: data.action,
        diffJson: data.diffJson ?? null,
      },
    });
  }
}
