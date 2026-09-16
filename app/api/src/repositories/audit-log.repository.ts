/**
 * audit-log.repository.ts
 *
 * Acesso a dados do AuditLog. Append-only por design: existem create() e
 * leitura, nunca update/delete — trilha de auditoria não pode ser alterada
 * depois de gravada.
 */

import { Prisma, type PrismaClient } from "@prisma/client";
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

  /**
   * Quando cada finding foi resolvido (CP-2): o PRIMEIRO STATUS_CHANGE → FIXED
   * de cada um, reconstruído da trilha — a mesma fonte que o
   * `metrics.repository.ts` usa para o MTTR, e pela mesma razão: não existe
   * coluna `resolvedAt`, e criar uma duplicaria o que o AuditLog já é obrigado
   * a ter (ADR-025: derivar, não fotografar).
   *
   * UMA consulta para a página inteira (ids em lote), nunca uma por finding.
   * Devolve um Map id → data; quem não está no Map não tem transição gravada.
   *
   * ⚠️ `JSON_VALID` antes de `JSON_EXTRACT` — ver o mesmo aviso no
   * metrics.repository: um diffJson malformado de OUTRA ação derrubaria a
   * consulta inteira sem o guarda.
   */
  async findFirstFixedAtByEntityIds(vulnerabilityIds: string[]): Promise<Map<string, Date>> {
    const saida = new Map<string, Date>();
    if (vulnerabilityIds.length === 0) return saida;
    const linhas = await this.prisma.$queryRaw<{ entityId: string; fixedAt: Date }[]>`
      SELECT a.entityId, MIN(a.createdAt) AS fixedAt
      FROM AuditLog a
      WHERE a.entityType = 'Vulnerability'
        AND a.action = 'STATUS_CHANGE'
        AND a.entityId IN (${Prisma.join(vulnerabilityIds)})
        AND JSON_VALID(a.diffJson)
        AND JSON_UNQUOTE(JSON_EXTRACT(a.diffJson, '$.to')) = 'FIXED'
      GROUP BY a.entityId
    `;
    for (const l of linhas) saida.set(l.entityId, new Date(l.fixedAt));
    return saida;
  }
}
