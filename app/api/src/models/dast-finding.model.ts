/**
 * dast-finding.model.ts
 *
 * Um alerta do ZAP já normalizado e persistido (1 instance do JSON bruto = 1
 * DastFinding). Ver services/dast-findings.service.ts pra normalização,
 * fingerprint e regras de deduplicação/escopo — este arquivo é só type+DTO+
 * entity, sem lógica de negócio (CLAUDE.md §5.1).
 */

import type { DastFinding as PrismaDastFinding, DastRisk, DastTriageStatus } from "@prisma/client";
import type { DastFindingWithPromotion } from "../repositories/dast-finding.repository";

export type DastFinding = PrismaDastFinding;
export type { DastRisk, DastTriageStatus };

/** O que a Vulnerability promovida expõe de volta pro finding de origem (ADR-032). */
export type PromotedVulnerabilityDTO = {
  id: string;
  projectId: string;
  severityFinal: string;
  status: string;
};

export type DastFindingResponseDTO = {
  id: string;
  scanId: string;
  pluginId: string;
  title: string;
  risk: DastRisk;
  confidence: string;
  cweId: string | null;
  wascId: string | null;
  url: string;
  normalizedUrl: string;
  param: string | null;
  evidence: string | null;
  description: string | null;
  solution: string | null;
  reference: string | null;
  createdAt: string;
  // --- Triagem (ADR-032) ---
  triageStatus: DastTriageStatus;
  triageNote: string | null;
  triagedByName: string | null;
  triagedAt: string | null;
  /** Preenchido quando este finding já virou uma Vulnerability; null caso contrário. */
  promotedVulnerability: PromotedVulnerabilityDTO | null;
};

// Ordem de severidade pra "lista completa ordenada por severidade" (§ Fase 4
// — endpoint /report/data) e pro "top 10 por criticidade".
export const RISK_ORDER: Record<DastRisk, number> = {
  HIGH: 0,
  MEDIUM: 1,
  LOW: 2,
  INFO: 3,
};

export class DastFindingEntity {
  // Aceita o finding COM as relações de triagem/promoção já carregadas (é o
  // que o repository devolve desde o ADR-032). O tipo cru continua aceito
  // porque nem todo caminho precisa das relações — as duas ficam null.
  constructor(private readonly data: DastFinding | DastFindingWithPromotion) {}

  get risk(): DastRisk {
    return this.data.risk;
  }

  private get relacoes(): Partial<Pick<DastFindingWithPromotion, "promotedVulnerability" | "triagedBy">> {
    return this.data as Partial<DastFindingWithPromotion>;
  }

  toResponse(): DastFindingResponseDTO {
    return {
      id: this.data.id,
      scanId: this.data.scanId,
      pluginId: this.data.pluginId,
      title: this.data.title,
      risk: this.data.risk,
      confidence: this.data.confidence,
      cweId: this.data.cweId,
      wascId: this.data.wascId,
      url: this.data.url,
      normalizedUrl: this.data.normalizedUrl,
      param: this.data.param,
      evidence: this.data.evidence,
      description: this.data.description,
      solution: this.data.solution,
      reference: this.data.reference,
      createdAt: this.data.createdAt.toISOString(),
      triageStatus: this.data.triageStatus,
      triageNote: this.data.triageNote,
      triagedByName: this.relacoes.triagedBy?.name ?? null,
      triagedAt: this.data.triagedAt?.toISOString() ?? null,
      promotedVulnerability: this.relacoes.promotedVulnerability ?? null,
    };
  }
}
