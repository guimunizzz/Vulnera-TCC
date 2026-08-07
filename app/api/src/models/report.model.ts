/**
 * report.model.ts
 *
 * Report é só METADADO do PDF gerado — o PDF em si é montado client-side com
 * pdf-lib (ADR-003 — "PDF gerado no cliente"). Este arquivo cobre duas coisas
 * bem diferentes:
 *
 * 1. Report (linhas 1-40): a entidade que existe no banco — histórico de
 *    "quem gerou o quê, quando". Segue o padrão type+DTO+entity de sempre.
 *
 * 2. ReportDataDTO (linhas 40+): NÃO é uma tabela — é a projeção agregada
 *    que GET /projects/:id/report-data devolve, computada em report.service
 *    a partir de Project/Application/Company/Vulnerability/Evidence/
 *    VulnerabilityComment. O frontend usa esse JSON pra desenhar o PDF.
 */

import type { Report as PrismaReport } from "@prisma/client";
import type { ProjectResponseDTO } from "./project.model";
import type { CompanyResponseDTO } from "./company.model";
import type { ApplicationResponseDTO } from "./application.model";
import type { VulnerabilityResponseDTO } from "./vulnerability.model";
import type { EvidenceResponseDTO } from "./evidence.model";

export type Report = PrismaReport;
export type ReportType = "EXECUTIVE" | "TECHNICAL";

export type CreateReportDTO = {
  projectId: string;
  type: ReportType;
};

export type ReportResponseDTO = {
  id: string;
  projectId: string;
  type: ReportType;
  title: string;
  generatedBy: string;
  createdAt: string;
};

export class ReportEntity {
  constructor(private readonly data: Report) {}

  toResponse(): ReportResponseDTO {
    return {
      id: this.data.id,
      projectId: this.data.projectId,
      type: this.data.type as ReportType,
      title: this.data.title,
      generatedBy: this.data.generatedBy,
      createdAt: this.data.createdAt.toISOString(),
    };
  }
}

// ============================================================================
// report-data — projeção computada (não é tabela)
// ============================================================================

/** Finding "enriquecido" pra fins de relatório: nomes resolvidos + evidências/comentários embutidos. */
export type ReportVulnerabilityDTO = VulnerabilityResponseDTO & {
  createdByName: string;
  evidences: EvidenceResponseDTO[];
  comments: Array<{
    id: string;
    authorId: string;
    authorName: string;
    content: string;
    createdAt: string;
  }>;
};

export type ReportStatsDTO = {
  total: number;
  bySeverity: Record<"CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "NONE", number>;
  byStatus: Record<"OPEN" | "IN_PROGRESS" | "FIXED" | "CLOSED", number>;
  byOwasp: Record<string, number>; // chaves A01..A10
};

export type ReportDataDTO = {
  project: ProjectResponseDTO;
  company: CompanyResponseDTO;
  application: ApplicationResponseDTO;
  vulnerabilities: ReportVulnerabilityDTO[];
  stats: ReportStatsDTO;
  topRisks: ReportVulnerabilityDTO[]; // 5 maiores por cvssScore
  maturity: null; // 🚧 [FUTURO] Fase 8 — placeholder condicional no PDF executivo
};
