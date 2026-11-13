/**
 * code-scan.model.ts
 *
 * DTOs de resposta das importações SAST/SCA (ADR-052). Só tipos e
 * serialização — a regra de negócio está em services/code-scan.service.ts.
 */

import type { DastTriageStatus } from "@prisma/client";
import type { CodeFindingWithRelations, CodeScanImportWithUploader } from "../repositories/code-scan.repository";
import type { CodeCategory, CodeReportFormat, CodeSeverity } from "../utils/code-import.util";

export type PromotedVulnerabilityRef = { id: string; projectId: string; severityFinal: string; status: string };

export interface CodeScanImportResponseDTO {
  id: string;
  projectId: string;
  projectName: string;
  applicationName: string;
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
  /** Achados por severidade nesta importação (triados ou não). */
  severityCounts: Record<CodeSeverity, number>;
}

export interface CodeFindingResponseDTO {
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
  /** true quando a triagem veio da importação anterior (o achado persistiu). */
  triageInherited: boolean;
  /**
   * A Vulnerability que este achado (ou o MESMO achado numa importação
   * anterior do projeto) já virou. null = ainda não promovido.
   */
  promotedVulnerability: PromotedVulnerabilityRef | null;
}

export function emptySeverityCounts(): Record<CodeSeverity, number> {
  return { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 };
}

export function toImportResponse(
  i: CodeScanImportWithUploader,
  severityCounts: Record<CodeSeverity, number> = emptySeverityCounts(),
): CodeScanImportResponseDTO {
  return {
    id: i.id,
    projectId: i.projectId,
    projectName: i.project.name,
    applicationName: i.project.application.name,
    format: i.format as CodeReportFormat,
    toolName: i.toolName,
    toolVersion: i.toolVersion,
    fileName: i.fileName,
    uploadedByName: i.uploadedBy.name,
    previousImportId: i.previousImportId,
    totalFindings: i.totalFindings,
    newFindings: i.newFindings,
    persistedFindings: i.persistedFindings,
    resolvedFindings: i.resolvedFindings,
    componentsCount: i.componentsCount,
    warningMessage: i.warningMessage,
    createdAt: i.createdAt.toISOString(),
    severityCounts,
  };
}

export function toFindingResponse(f: CodeFindingWithRelations, promotedElsewhere?: PromotedVulnerabilityRef): CodeFindingResponseDTO {
  return {
    id: f.id,
    importId: f.importId,
    projectId: f.projectId,
    fingerprint: f.fingerprint,
    category: f.category as CodeCategory,
    ruleId: f.ruleId,
    title: f.title,
    severity: f.severity as CodeSeverity,
    cweId: f.cweId,
    filePath: f.filePath,
    startLine: f.startLine,
    endLine: f.endLine,
    snippet: f.snippet,
    packageName: f.packageName,
    packageVersion: f.packageVersion,
    purl: f.purl,
    fixedVersion: f.fixedVersion,
    advisoryId: f.advisoryId,
    cvssScore: f.cvssScore,
    cvssVector: f.cvssVector,
    description: f.description,
    recommendation: f.recommendation,
    helpUri: f.helpUri,
    triageStatus: f.triageStatus,
    triageNote: f.triageNote,
    triagedByName: f.triagedBy?.name ?? null,
    triagedAt: f.triagedAt?.toISOString() ?? null,
    triageInherited: f.triageInherited,
    promotedVulnerability: f.promotedVulnerability ?? promotedElsewhere ?? null,
  };
}
