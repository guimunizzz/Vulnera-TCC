/**
 * risk-acceptance.repository.ts
 *
 * Única camada que toca prisma.riskAcceptance.* — sem lógica de negócio.
 *
 * ⚠️ NÃO EXISTE `update` GENÉRICO, de propósito. Um aceite decidido é
 * imutável (D10): as únicas escritas são as TRANSIÇÕES nomeadas (approve,
 * reject, revoke, expire), cada uma condicionada ao status de origem. Um
 * `update(id, data)` aberto seria a porta por onde alguém reescreveria a
 * justificativa ou esticaria o prazo depois da assinatura.
 *
 * 🎯 TODA TRANSIÇÃO É CONDICIONAL (`updateMany` com o status esperado no
 * WHERE) e devolve a CONTAGEM. É o que fecha a janela entre "li o registro" e
 * "gravei a mudança": dois cliques simultâneos passam os dois pela leitura,
 * mas só um altera a linha — e só quem alterou audita. Sem isso, a expiração
 * preguiçosa geraria AuditLog duplicado sob concorrência.
 */

import { Prisma, type PrismaClient } from "@prisma/client";
import type { RiskAcceptance, RiskAcceptanceWithActors } from "../models/risk-acceptance.model";
import { RISK_ACCEPTANCE_ACTIVE_STATUSES } from "../models/risk-acceptance.model";
import type { EscopoDeAcesso } from "./vulnerability.repository";

/** Nomes de quem pediu/decidiu/revogou — a trilha lida por gente. */
const ATORES = {
  requestedBy: { select: { name: true } },
  reviewedBy: { select: { name: true } },
  revokedBy: { select: { name: true } },
} as const;

export interface CreateRiskAcceptanceData {
  vulnerabilityId: string;
  companyId: string;
  reason: string;
  businessJustification: string;
  compensatingControls?: string | null;
  requestedById: string;
  requestedExpiresAt?: Date | null;
}

export class RiskAcceptanceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<RiskAcceptance | null> {
    return this.prisma.riskAcceptance.findUnique({ where: { id } });
  }

  async findByIdWithActors(id: string): Promise<RiskAcceptanceWithActors | null> {
    return this.prisma.riskAcceptance.findUnique({ where: { id }, include: ATORES });
  }

  /** Histórico completo de um finding, do mais recente ao mais antigo. */
  async findByVulnerability(vulnerabilityId: string): Promise<RiskAcceptanceWithActors[]> {
    return this.prisma.riskAcceptance.findMany({
      where: { vulnerabilityId },
      include: ATORES,
      orderBy: { requestedAt: "desc" },
    });
  }

  /** O aceite não-terminal (REQUESTED ou APPROVED) do finding, se houver. */
  async findActiveByVulnerability(vulnerabilityId: string): Promise<RiskAcceptance | null> {
    return this.prisma.riskAcceptance.findFirst({
      where: { vulnerabilityId, status: { in: [...RISK_ACCEPTANCE_ACTIVE_STATUSES] } },
      orderBy: { requestedAt: "desc" },
    });
  }

  /**
   * APROVADOS já vencidos de um conjunto de findings — o que a leitura precisa
   * normalizar. Uma consulta para a página inteira, nunca uma por linha.
   */
  async findExpiredApproved(vulnerabilityIds: string[], now: Date): Promise<RiskAcceptance[]> {
    if (vulnerabilityIds.length === 0) return [];
    return this.prisma.riskAcceptance.findMany({
      where: { vulnerabilityId: { in: vulnerabilityIds }, status: "APPROVED", expiresAt: { lt: now } },
    });
  }

  /**
   * Aprovados vencidos apenas nos findings que o ator pode enxergar.
   *
   * A normalização grava `EXPIRED` e desloca o SLA; por isso a consulta precisa
   * carregar o mesmo escopo da listagem. Fazer `findMany` global antes do RBAC
   * transformava uma leitura de A em uma escrita também nos dados de B.
   */
  async findExpiredApprovedForScope(scope: EscopoDeAcesso, now: Date): Promise<RiskAcceptance[]> {
    const vulnerability =
      scope.tipo === "TODAS"
        ? {}
        : scope.tipo === "COMPANY"
          ? { companyId: scope.companyId }
          : { project: { members: { some: { userId: scope.userId } } } };
    return this.prisma.riskAcceptance.findMany({
      where: { status: "APPROVED", expiresAt: { lt: now }, vulnerability },
    });
  }

  /**
   * Aceites VIGENTES de um conjunto de findings — alimenta o estado ACCEPTED
   * do SLA na listagem. Map id do finding → aceite, em UMA consulta.
   */
  async findActiveByVulnerabilityIds(vulnerabilityIds: string[], now: Date): Promise<Map<string, RiskAcceptance>> {
    const saida = new Map<string, RiskAcceptance>();
    if (vulnerabilityIds.length === 0) return saida;
    const linhas = await this.prisma.riskAcceptance.findMany({
      where: { vulnerabilityId: { in: vulnerabilityIds }, status: "APPROVED", expiresAt: { gt: now } },
      orderBy: { reviewedAt: "desc" },
    });
    for (const ra of linhas) if (!saida.has(ra.vulnerabilityId)) saida.set(ra.vulnerabilityId, ra);
    return saida;
  }

  async create(data: CreateRiskAcceptanceData): Promise<RiskAcceptance> {
    return this.prisma.riskAcceptance.create({ data });
  }

  /**
   * Cria o único pedido ativo do finding sob lock pessimista do MySQL.
   *
   * O schema não pode expressar um unique parcial (REQUESTED/APPROVED), e um
   * `findActive` seguido de `create` deixa uma janela TOCTOU. O SELECT FOR
   * UPDATE bloqueia a linha pai do finding na conexão da transação interativa;
   * assim, a segunda transação só consulta o aceite depois do commit da
   * primeira. Não há alteração de schema; `null` significa que outro pedido
   * ativo já existia.
   */
  async createIfNoActive(data: CreateRiskAcceptanceData): Promise<RiskAcceptance | null> {
    return this.prisma.$transaction(async (tx) => {
      const finding = await tx.$queryRaw<Array<{ id: string }>>(
        Prisma.sql`SELECT id FROM \`Vulnerability\` WHERE id = ${data.vulnerabilityId} FOR UPDATE`,
      );
      if (!finding[0]) throw new Error("VULNERABILITY_NOT_FOUND");

      const active = await tx.riskAcceptance.findFirst({
        where: { vulnerabilityId: data.vulnerabilityId, status: { in: [...RISK_ACCEPTANCE_ACTIVE_STATUSES] } },
        orderBy: { requestedAt: "desc" },
      });
      if (active) return null;
      return await tx.riskAcceptance.create({ data });
    });
  }

  /* ======================================================================
     Transições — todas CONDICIONAIS, todas devolvem a contagem
     ======================================================================
     `count === 0` significa "alguém chegou antes" (ou o status de origem não
     era o esperado). Quem chamou decide: erro de transição inválida, ou
     silêncio — no caso da expiração, silêncio, porque o trabalho já foi feito.
     ====================================================================== */

  async approve(id: string, data: { reviewedById: string; reviewedAt: Date; expiresAt: Date; reviewNote: string | null }): Promise<number> {
    const r = await this.prisma.riskAcceptance.updateMany({
      where: { id, status: "REQUESTED" },
      data: { status: "APPROVED", ...data },
    });
    return r.count;
  }

  async reject(id: string, data: { reviewedById: string; reviewedAt: Date; reviewNote: string }): Promise<number> {
    const r = await this.prisma.riskAcceptance.updateMany({
      where: { id, status: "REQUESTED" },
      data: { status: "REJECTED", endedAt: data.reviewedAt, ...data },
    });
    return r.count;
  }

  async revoke(id: string, data: { revokedById: string; revokedAt: Date; revokeReason: string }): Promise<number> {
    const r = await this.prisma.riskAcceptance.updateMany({
      where: { id, status: "APPROVED" },
      data: { status: "REVOKED", endedAt: data.revokedAt, ...data },
    });
    return r.count;
  }

  /**
   * Consolida a expiração de UM aceite. O WHERE carrega as três condições
   * (id + APPROVED + vencido), então duas requisições concorrentes produzem
   * exatamente um `count: 1` e um `count: 0` — e só o primeiro audita.
   */
  async expire(id: string, now: Date): Promise<number> {
    const r = await this.prisma.riskAcceptance.updateMany({
      where: { id, status: "APPROVED", expiresAt: { lt: now } },
      data: { status: "EXPIRED", endedAt: now },
    });
    return r.count;
  }
}
