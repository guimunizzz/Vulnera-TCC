/**
 * findings-export.model.ts
 *
 * Tipos da exportação Excel de findings (`GET /vulnerabilities/export.xlsx`).
 *
 * POR QUE UMA LINHA PRÓPRIA, NÃO O `VulnerabilityListItemDTO`
 * O item de lista é enxuto de propósito (ver o cabeçalho de `vulnerability.model`):
 * não carrega `description`, `impact` nem `recommendation`. A planilha precisa
 * deles — e das datas como `Date`, não como string ISO, porque o Excel guarda
 * data como número e quem converte é o gerador, já no fuso de São Paulo.
 *
 * O que há aqui NUNCA é mais do que o ator já vê: é o mesmo conjunto de
 * findings da listagem (mesmo escopo, mesmo filtro) e os mesmos campos que a
 * página de detalhe mostra a esse papel.
 */

import type { SlaState } from "../utils/sla.util";
import type { VrsBand } from "../utils/vrs.util";
import type { VulnerabilityStatus } from "./vulnerability.model";

/** Quantos findings o exportador lê por vez do banco. */
export const EXPORT_BATCH_SIZE = 1000;

/** Uma linha da aba Findings — o finding com os nomes do contexto já resolvidos. */
export type FindingsExportRow = {
  id: string;
  title: string;
  description: string;
  impact: string | null;
  recommendation: string | null;
  severityFinal: string;
  severityCalculated: string;
  cvssScore: number | null;
  status: VulnerabilityStatus;
  owaspCategory: string;
  projectName: string;
  /** O "ativo" da planilha: a Application analisada. */
  applicationName: string;
  companyName: string;
  slaState: SlaState;
  slaDueAt: Date | null;
  vrsScore: number | null;
  vrsBand: VrsBand | null;
  hasActiveRiskAcceptance: boolean;
  assigneeName: string | null;
  /** MANUAL | DAST_IMPORT (ADR-032). */
  sourceType: string;
  /** `CWE-89`. Só existe para finding promovido de DAST. */
  cweId: string | null;
  /** Primeira transição para FIXED, reconstruída do AuditLog. null = sem trilha. */
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};
