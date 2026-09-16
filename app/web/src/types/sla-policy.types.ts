/**
 * sla-policy.types.ts
 *
 * Espelha `SlaPolicyResponseDTO` do backend (CP-2). Uma política é versionada:
 * salvar cria uma linha nova e desativa a anterior — o histórico vem em
 * `/history`, e `isDefault` diz quando a resposta é a padrão do produto
 * (a empresa ainda não definiu a sua).
 */

export interface SlaPolicy {
  id: string;
  companyId: string | null;
  name: string;
  criticalDays: number;
  highDays: number;
  mediumDays: number;
  lowDays: number;
  isActive: boolean;
  isDefault: boolean;
  createdBy: string;
  createdAt: string;
}

export interface UpsertSlaPolicyInput {
  name?: string;
  criticalDays: number;
  highDays: number;
  mediumDays: number;
  lowDays: number;
}

/** Sanidade espelhada do backend (1..365 dias). */
export const SLA_DAYS_MIN = 1;
export const SLA_DAYS_MAX = 365;
