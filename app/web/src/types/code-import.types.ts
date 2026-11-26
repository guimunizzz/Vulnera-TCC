/**
 * code-import.types.ts — contrato das importações SAST/SCA (ADR-052).
 * Espelha app/api/src/models/code-scan.model.ts.
 */

import type { DastTriageStatus, PromotedVulnerability } from "./dast.types";

export type CodeSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
export type CodeCategory = "SAST" | "SCA";
export type CodeReportFormat = "SARIF" | "CYCLONEDX";

export interface CodeScanImport {
  id: string;
  projectId: string;
  projectName: string;
  applicationName: string;
  companyName: string;
  format: CodeReportFormat;
  toolName: string;
  toolVersion: string | null;
  fileName: string;
  uploadedByName: string;
  previousImportId: string | null;
  totalFindings: number;
  newFindings: number;
  persistedFindings: number;
  resolvedFindings: number;
  componentsCount: number | null;
  warningMessage: string | null;
  createdAt: string;
  severityCounts: Record<CodeSeverity, number>;
}

export interface CodeFinding {
  id: string;
  importId: string;
  projectId: string;
  fingerprint: string;
  category: CodeCategory;
  ruleId: string;
  title: string;
  severity: CodeSeverity;
  cweId: string | null;
  filePath: string | null;
  startLine: number | null;
  endLine: number | null;
  snippet: string | null;
  packageName: string | null;
  packageVersion: string | null;
  purl: string | null;
  fixedVersion: string | null;
  advisoryId: string | null;
  cvssScore: number | null;
  cvssVector: string | null;
  description: string | null;
  recommendation: string | null;
  helpUri: string | null;
  triageStatus: DastTriageStatus;
  triageNote: string | null;
  triagedByName: string | null;
  triagedAt: string | null;
  triageInherited: boolean;
  promotedVulnerability: PromotedVulnerability | null;
  /** Calculada pela API na leitura: contexto do arquivo, sinais de outras fontes e sugestão (só para NEW). */
  preTriagem: PreTriagem;
}

/** Onde o achado está. Tudo que não é PRODUCAO recebe sugestão de falso-positivo. */
export type CodeContext = "PRODUCAO" | "TESTE" | "FIXTURE" | "DOCUMENTACAO" | "GERADO" | "SCRIPT";

export const CODE_CONTEXT_LABELS: Record<CodeContext, string> = {
  PRODUCAO: "produção",
  TESTE: "teste",
  FIXTURE: "fixture",
  DOCUMENTACAO: "documentação",
  GERADO: "artefato gerado",
  SCRIPT: "script/seed",
};

export interface CodeSignal {
  tipo: "KEV" | "EPSS" | "DAST_CONFIRMADO" | "THREAT_INTEL";
  forte: boolean;
  detalhe: string;
  vulnerabilityId?: string;
}

export interface PreTriagem {
  contexto: CodeContext;
  sinais: CodeSignal[];
  sugestao: { tipo: "FALSO_POSITIVO" | "PROVAVEL_VULNERABILIDADE"; motivo: string } | null;
}

export interface CodeAcceptSuggestionsResult {
  accepted: number;
  byContext: Partial<Record<CodeContext, number>>;
}

export interface CodePromotionDraft {
  title: string;
  description: string;
  owaspCategory: string;
  cvssVector: string;
  /** NVD: o relatório não trouxe vetor e ele veio do Threat Intel. */
  cvssVectorSource: "TOOL" | "SEVERITY" | "NVD";
  sinais: CodeSignal[];
  recommendation: string | null;
  impact: string | null;
  alreadyPromotedTo: string | null;
}

export interface CodePromoteInput {
  title: string;
  description: string;
  owaspCategory: string;
  cvssVector: string;
  impact?: string;
  recommendation?: string;
}

export interface CodeComparisonEntry {
  fingerprint: string;
  title: string;
  severity: CodeSeverity;
  category: CodeCategory;
  location: string | null;
  promotedVulnerability: PromotedVulnerability | null;
}

export interface CodeImportComparison {
  headImport: CodeScanImport;
  baseImport: CodeScanImport | null;
  introduced: CodeComparisonEntry[];
  persisted: CodeComparisonEntry[];
  resolved: CodeComparisonEntry[];
  /** CODE-FUT-03: vulnerabilidade FIXED cujo achado reapareceu depois da correção (só na importação mais recente). */
  reopenCandidates: CodeComparisonEntry[];
}

export const CODE_SEVERITY_ORDER: CodeSeverity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"];

export interface CodeImportReportData {
  import: CodeScanImport;
  findings: CodeFinding[];
  resolved: CodeComparisonEntry[];
  generatedAt: string;
}

export const CODE_SEVERITY_LABELS: Record<CodeSeverity, string> = {
  CRITICAL: "Crítica",
  HIGH: "Alta",
  MEDIUM: "Média",
  LOW: "Baixa",
  INFO: "Informativa",
};

export const CODE_FORMAT_LABELS: Record<CodeReportFormat, string> = { SARIF: "SARIF", CYCLONEDX: "CycloneDX" };

/** Onde está o achado, numa linha: arquivo:linha (SAST) ou pacote@versão (SCA). */
export function localDoAchado(f: Pick<CodeFinding, "filePath" | "startLine" | "packageName" | "packageVersion">): string {
  if (f.filePath) return f.startLine ? `${f.filePath}:${f.startLine}` : f.filePath;
  if (f.packageName) return f.packageVersion ? `${f.packageName}@${f.packageVersion}` : f.packageName;
  return "—";
}
