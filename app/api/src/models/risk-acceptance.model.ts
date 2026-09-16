/**
 * risk-acceptance.model.ts
 *
 * Tipos do domínio RiskAcceptance (CP-4) — o aceite FORMAL de risco.
 *
 * 🎯 ENTIDADE PRÓPRIA, NUNCA UM STATUS DE VULNERABILITY (docs/DECISIONS.md D10).
 * A vulnerabilidade continua `OPEN`/`IN_PROGRESS` enquanto o aceite vale.
 * "Risco aceito" e "finding fechado" são afirmações diferentes: um CLOSED diz
 * "não existe mais"; um aceite diz "existe, sabemos, decidimos conviver, até
 * tal data, e fulano assinou". Colapsar os dois no mesmo campo destruiria
 * exatamente a informação que torna o aceite defensável numa auditoria.
 *
 * MÁQUINA DE ESTADOS
 *   REQUESTED → APPROVED | REJECTED
 *   APPROVED  → REVOKED | EXPIRED
 *   REJECTED, REVOKED, EXPIRED são TERMINAIS
 *
 * NÃO-TERMINAIS (`ACTIVE_STATUSES`) são os que bloqueiam um segundo pedido no
 * mesmo finding: um aceite em análise ou vigente é o aceite daquele risco.
 * Os terminais coexistem à vontade — são o histórico, e histórico não se apaga.
 *
 * IMUTÁVEL DEPOIS DA DECISÃO: não existe DTO de update. Estender um prazo é
 * pedir de novo; encerrar antes é revogar. É o que fecha o vetor "expiração
 * manipulável" do threat model.
 */

import type { RiskAcceptance as PrismaRiskAcceptance } from "@prisma/client";

export type RiskAcceptance = PrismaRiskAcceptance;

export const RISK_ACCEPTANCE_STATUSES = ["REQUESTED", "APPROVED", "REJECTED", "REVOKED", "EXPIRED"] as const;
export type RiskAcceptanceStatus = (typeof RISK_ACCEPTANCE_STATUSES)[number];

/**
 * Estados NÃO-TERMINAIS. Um finding pode ter no máximo um aceite em algum
 * destes; os demais são história. `APPROVED` entra aqui mesmo podendo estar
 * vencido — a expiração é preguiçosa (ver service), e um APPROVED vencido é
 * normalizado para EXPIRED antes de qualquer decisão sobre pedido novo.
 */
export const RISK_ACCEPTANCE_ACTIVE_STATUSES: readonly RiskAcceptanceStatus[] = ["REQUESTED", "APPROVED"];

/** Teto de produto: um aceite não vale mais de um ano sem nova aprovação. */
export const RISK_ACCEPTANCE_MAX_DAYS = 365;

/** Mesmos limites do override de severidade (RN21) — justificativa de verdade, sem virar dump. */
export const RISK_ACCEPTANCE_FIELD_LIMITS = {
  reasonMin: 20,
  reasonMax: 2000,
  justificationMin: 20,
  justificationMax: 5000,
  compensatingControlsMax: 5000,
  reviewNoteMax: 2000,
  revokeReasonMin: 10,
  revokeReasonMax: 2000,
} as const;

export type CreateRiskAcceptanceDTO = {
  reason: string;
  businessJustification: string;
  compensatingControls?: string | null;
  /** Prazo PROPOSTO pelo solicitante. O aprovador pode manter ou encurtar, nunca alongar. */
  requestedExpiresAt?: Date | null;
};

export type ApproveRiskAcceptanceDTO = {
  expiresAt: Date;
  reviewNote?: string | null;
};

export type RejectRiskAcceptanceDTO = {
  reviewNote: string;
};

export type RevokeRiskAcceptanceDTO = {
  reason: string;
};

/** O registro com os nomes de quem pediu/decidiu/revogou — a trilha lida por gente, não por cuid. */
export type RiskAcceptanceWithActors = RiskAcceptance & {
  requestedBy: { name: string };
  reviewedBy: { name: string } | null;
  revokedBy: { name: string } | null;
};

export type RiskAcceptanceResponseDTO = {
  id: string;
  vulnerabilityId: string;
  companyId: string;
  status: RiskAcceptanceStatus;
  reason: string;
  businessJustification: string;
  compensatingControls: string | null;
  requestedById: string;
  requestedByName: string;
  requestedAt: string;
  requestedExpiresAt: string | null;
  reviewedById: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  expiresAt: string | null;
  revokedById: string | null;
  revokedByName: string | null;
  revokedAt: string | null;
  revokeReason: string | null;
  endedAt: string | null;
  /** Derivado: o aceite está valendo AGORA (APPROVED e dentro do prazo)? */
  isActive: boolean;
  createdAt: string;
};

export class RiskAcceptanceEntity {
  constructor(
    private readonly data: RiskAcceptanceWithActors,
    private readonly now: Date = new Date(),
  ) {}

  toResponse(): RiskAcceptanceResponseDTO {
    return {
      id: this.data.id,
      vulnerabilityId: this.data.vulnerabilityId,
      companyId: this.data.companyId,
      status: this.data.status as RiskAcceptanceStatus,
      reason: this.data.reason,
      businessJustification: this.data.businessJustification,
      compensatingControls: this.data.compensatingControls,
      requestedById: this.data.requestedById,
      requestedByName: this.data.requestedBy.name,
      requestedAt: this.data.requestedAt.toISOString(),
      requestedExpiresAt: this.data.requestedExpiresAt?.toISOString() ?? null,
      reviewedById: this.data.reviewedById,
      reviewedByName: this.data.reviewedBy?.name ?? null,
      reviewedAt: this.data.reviewedAt?.toISOString() ?? null,
      reviewNote: this.data.reviewNote,
      expiresAt: this.data.expiresAt?.toISOString() ?? null,
      revokedById: this.data.revokedById,
      revokedByName: this.data.revokedBy?.name ?? null,
      revokedAt: this.data.revokedAt?.toISOString() ?? null,
      revokeReason: this.data.revokeReason,
      endedAt: this.data.endedAt?.toISOString() ?? null,
      isActive: isAcceptanceActive(this.data, this.now),
      createdAt: this.data.createdAt.toISOString(),
    };
  }
}

/**
 * O aceite está VALENDO neste instante?
 *
 * APPROVED + prazo no futuro. Função pura, usada tanto pelo DTO quanto pelo
 * cálculo do estado de SLA — os dois têm de concordar, e concordam por usarem
 * a mesma regra em vez de duas cópias.
 *
 * ⚠️ Um APPROVED com `expiresAt` no passado NÃO está ativo, mesmo que a linha
 * ainda diga APPROVED: a expiração é preguiçosa e pode não ter sido
 * consolidada ainda. Quem lê enxerga a verdade; quem escreve consolida.
 */
export function isAcceptanceActive(
  ra: Pick<RiskAcceptance, "status" | "expiresAt">,
  now: Date = new Date(),
): boolean {
  if (ra.status !== "APPROVED") return false;
  if (!ra.expiresAt) return false;
  return ra.expiresAt.getTime() > now.getTime();
}
