/** Contratos do relatório executivo da API, consumidos pelas telas e gerador de PDF mobile. */
import type { Project } from "./project.types";

export type ReportEntry = { id: string; projectId: string; type: "EXECUTIVE" | "TECHNICAL"; title: string; generatedBy: string; createdAt: string };
export type ReportFinding = { id: string; title: string; severityFinal: string; status: string; cvssScore: number | null; owaspCategory: string; recommendation: string | null };
export type ReportAcceptedRisk = { vulnerabilityId: string; title: string; severityFinal: string; cvssScore: number | null; reason: string; businessJustification: string; compensatingControls: string | null; expiresAt: string | null; requestedByName: string; approvedByName: string | null };
export type ReportData = {
  project: Project; company: { name: string }; application: { name: string };
  vulnerabilities: ReportFinding[];
  stats: { total: number; bySeverity: Record<"CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "NONE", number>; byStatus: Record<"OPEN" | "IN_PROGRESS" | "FIXED" | "CLOSED", number> };
  topRisks: ReportFinding[];
  maturity: { overallScore: number; level: string; evaluatedAt: string; domains: { domainId: string; domainName: string; average: number }[] } | null;
  acceptedRisks: ReportAcceptedRisk[];
};
