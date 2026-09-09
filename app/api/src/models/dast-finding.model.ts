/**
 * dast-finding.model.ts
 *
 * Um alerta do ZAP já normalizado e persistido (1 instance do JSON bruto = 1
 * DastFinding). Ver services/dast-findings.service.ts pra normalização,
 * fingerprint e regras de deduplicação/escopo — este arquivo é só type+DTO+
 * entity, sem lógica de negócio (CLAUDE.md §5.1).
 */

import type { DastFinding as PrismaDastFinding, DastRisk } from "@prisma/client";

export type DastFinding = PrismaDastFinding;
export type { DastRisk };

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
  constructor(private readonly data: DastFinding) {}

  get risk(): DastRisk {
    return this.data.risk;
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
    };
  }
}
