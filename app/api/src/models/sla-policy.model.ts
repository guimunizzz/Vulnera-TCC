/**
 * sla-policy.model.ts
 *
 * Tipos do domínio SlaPolicy (CP-2) — os prazos de remediação por severidade.
 *
 * Uma política é VERSIONADA, não editada: "alterar" cria uma linha nova e
 * desativa a anterior, para que `Vulnerability.slaPolicyId` continue apontando
 * para os números que geraram aquele prazo. É o que torna um estouro de SLA
 * explicável meses depois ("venceu em 12/09 porque a política v2 dava 7 dias
 * para HIGH"), mesmo que a política de hoje seja outra.
 *
 * `companyId = null` é a política PADRÃO do produto — o fallback de quem
 * nunca configurou a sua. Uma só, criada pelo seed.
 */

import type { SlaPolicy as PrismaSlaPolicy } from "@prisma/client";
import type { SlaWindow } from "../utils/sla.util";

export type SlaPolicy = PrismaSlaPolicy;

/** Os prazos que o produto assume quando nem a empresa nem o seed definiram nada. */
export const DEFAULT_SLA_WINDOW: SlaWindow = {
  criticalDays: 2,
  highDays: 7,
  mediumDays: 30,
  lowDays: 90,
};

/** Tetos de sanidade: 1 dia a 1 ano. Zero dias vence na criação; mais de um ano não é SLA. */
export const SLA_DAYS_MIN = 1;
export const SLA_DAYS_MAX = 365;

export type UpsertSlaPolicyDTO = {
  name?: string;
  criticalDays: number;
  highDays: number;
  mediumDays: number;
  lowDays: number;
};

export type SlaPolicyResponseDTO = {
  id: string;
  companyId: string | null;
  name: string;
  criticalDays: number;
  highDays: number;
  mediumDays: number;
  lowDays: number;
  isActive: boolean;
  /** true quando a resposta é a política padrão do produto (a empresa não tem a sua). */
  isDefault: boolean;
  createdBy: string;
  createdAt: string;
};

export class SlaPolicyEntity {
  constructor(private readonly data: SlaPolicy) {}

  toResponse(): SlaPolicyResponseDTO {
    return {
      id: this.data.id,
      companyId: this.data.companyId,
      name: this.data.name,
      criticalDays: this.data.criticalDays,
      highDays: this.data.highDays,
      mediumDays: this.data.mediumDays,
      lowDays: this.data.lowDays,
      isActive: this.data.isActive,
      isDefault: this.data.companyId === null,
      createdBy: this.data.createdBy,
      createdAt: this.data.createdAt.toISOString(),
    };
  }

  window(): SlaWindow {
    return {
      criticalDays: this.data.criticalDays,
      highDays: this.data.highDays,
      mediumDays: this.data.mediumDays,
      lowDays: this.data.lowDays,
    };
  }
}
