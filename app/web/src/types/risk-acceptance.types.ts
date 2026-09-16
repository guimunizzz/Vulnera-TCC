/**
 * risk-acceptance.types.ts
 *
 * Espelha `RiskAcceptanceResponseDTO` do backend (CP-4).
 *
 * 🎯 O aceite NÃO é um status da Vulnerability. O finding continua
 * OPEN/IN_PROGRESS enquanto o risco é aceito; o aceite é uma entidade
 * paralela, com autor, assinatura e validade próprias. A UI reflete isso:
 * badge ao lado do status, nunca no lugar dele.
 */

export const RISK_ACCEPTANCE_STATUSES = ["REQUESTED", "APPROVED", "REJECTED", "REVOKED", "EXPIRED"] as const;
export type RiskAcceptanceStatus = (typeof RISK_ACCEPTANCE_STATUSES)[number];

export const RISK_ACCEPTANCE_STATUS_LABELS: Record<RiskAcceptanceStatus, string> = {
  REQUESTED: "Aguardando decisão",
  APPROVED: "Risco aceito",
  REJECTED: "Recusado",
  REVOKED: "Revogado",
  EXPIRED: "Expirado",
};

/** O que a busca aceita em `?riskAcceptance=`. */
export const RISK_ACCEPTANCE_FILTER_VALUES = ["ACTIVE", "EXPIRED", "REQUESTED", "NONE"] as const;

export interface RiskAcceptance {
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
  /** APPROVED e dentro do prazo — derivado pelo backend. */
  isActive: boolean;
  createdAt: string;
}

export interface RequestRiskAcceptanceInput {
  reason: string;
  businessJustification: string;
  compensatingControls?: string | null;
  requestedExpiresAt?: string | null;
}

/** Limites espelhados do backend (`RISK_ACCEPTANCE_FIELD_LIMITS`). */
export const RISK_ACCEPTANCE_LIMITS = {
  reasonMin: 20,
  reasonMax: 2000,
  justificationMin: 20,
  justificationMax: 5000,
  compensatingControlsMax: 5000,
  reviewNoteMax: 2000,
  revokeReasonMin: 10,
  maxDays: 365,
} as const;
