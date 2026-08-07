// Tipos espelham os DTOs do backend (app/api/src/models/report.model.ts).

import type { Project } from "./project.types";
import type { Company } from "./company.types";
import type { Application } from "./application.types";
import type { Vulnerability } from "./vulnerability.types";
import type { Evidence } from "./evidence.types";

export type ReportType = "EXECUTIVE" | "TECHNICAL";

export interface Report {
  id: string;
  projectId: string;
  type: ReportType;
  title: string;
  generatedBy: string;
  createdAt: string;
}

export interface ReportComment {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
}

/** Finding "enriquecido" pra fins de relatório — nome resolvido + evidências/comentários embutidos. */
export type ReportVulnerability = Vulnerability & {
  createdByName: string;
  evidences: Evidence[];
  comments: ReportComment[];
};

export interface ReportStats {
  total: number;
  bySeverity: Record<"CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "NONE", number>;
  byStatus: Record<"OPEN" | "IN_PROGRESS" | "FIXED" | "CLOSED", number>;
  byOwasp: Record<string, number>;
}

/** null até a Fase 8 — placeholder condicional no PDF executivo. */
export type ReportMaturity = null;

export interface ReportData {
  project: Project;
  company: Company;
  application: Application;
  vulnerabilities: ReportVulnerability[];
  stats: ReportStats;
  topRisks: ReportVulnerability[];
  maturity: ReportMaturity;
}
