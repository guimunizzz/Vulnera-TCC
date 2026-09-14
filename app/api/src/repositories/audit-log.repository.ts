/**
 * audit-log.repository.ts
 *
 * Acesso a dados do AuditLog. Append-only por design: existem create() e
 * leitura, nunca update/delete — trilha de auditoria não pode ser alterada
 * depois de gravada.
 */

import type { PrismaClient } from "@prisma/client";
import type { AuditLog, AuditLogWithActor, CreateAuditLogDTO } from "../models/audit-log.model";

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

  /**
   * Trilha de uma entidade, do mais antigo pro mais recente.
   *
   * Ordem cronológica crescente porque é uma HISTÓRIA: "criado → mudou pra
   * IN_PROGRESS → severidade sobrescrita" só se lê de cima pra baixo. É a
   * mesma escolha do `vulnerability-comment.repository`, pelo mesmo motivo.
   *
   * Sem paginação: a trilha de um finding tem ordem de grandeza de dezenas de
   * eventos, não de milhares. Se um dia passar disso, pagina-se aqui.
   */
  async findByEntity(entityType: string, entityId: string): Promise<AuditLogWithActor[]> {
    return this.prisma.auditLog.findMany({
      where: { entityType, entityId },
      include: { actor: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    });
  }
}
