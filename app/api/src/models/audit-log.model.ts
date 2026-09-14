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

/* ==========================================================================
   Leitura da trilha (Fase 9 — FEAT-09)
   ==========================================================================
   Até aqui o AuditLog era append-only E write-only: existia `create()` e mais
   nada. A trilha era gravada e nunca lida por ninguém — quem auditava um
   finding tinha que abrir o banco na mão.

   A página de detalhe do finding mostra essa trilha, então passou a existir
   um caminho de LEITURA. Continua sem update e sem delete: trilha de
   auditoria não se corrige depois de gravada.
   ========================================================================== */

/** O registro com o nome de quem agiu — "por Fulano" em vez de um cuid. */
export type AuditLogWithActor = AuditLog & { actor: { name: string } };

export type AuditLogResponseDTO = {
  id: string;
  action: string;
  actorId: string;
  actorName: string;
  /** Já desserializado — o cliente não deveria precisar dar `JSON.parse` na resposta. */
  diff: unknown;
  createdAt: string;
};

export class AuditLogEntity {
  constructor(private readonly data: AuditLogWithActor) {}

  toResponse(): AuditLogResponseDTO {
    return {
      id: this.data.id,
      action: this.data.action,
      actorId: this.data.actorId,
      actorName: this.data.actor.name,
      diff: this.parseDiff(),
      createdAt: this.data.createdAt.toISOString(),
    };
  }

  /**
   * `diffJson` é TEXT com JSON gravado por `JSON.stringify`. Um registro
   * corrompido (ou gravado por uma versão antiga com outro formato) não pode
   * derrubar a trilha inteira — sem trilha, a página de detalhe quebra por
   * causa de UMA linha ruim. Nesse caso devolve null e o resto continua.
   */
  private parseDiff(): unknown {
    if (!this.data.diffJson) return null;
    try {
      return JSON.parse(this.data.diffJson);
    } catch {
      return null;
    }
  }
}
