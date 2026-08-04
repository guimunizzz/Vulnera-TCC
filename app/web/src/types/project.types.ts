export type ProjectStatus = "PENDING" | "IN_PROGRESS" | "IN_REVIEW" | "COMPLETED";

// Tipos reais aceitos pelo backend (schema.prisma) — não confundir com o
// texto "PENTEST/DAST/SAST" do prompt de produto, que diverge do schema.
export type AnalysisType = "SAST" | "DAST" | "MATURITY" | "COMBO";
export type AnalysisLevel = "BASIC" | "INTERMEDIATE" | "ADVANCED";

export interface Project {
  id: string;
  name: string;
  description: string | null;
  applicationId: string;
  companyId: string;
  analysisType: string;
  analysisLevel: string;
  hasRemediation: boolean;
  scopeIn: string | null;
  scopeOut: string | null;
  notes: string | null;
  status: ProjectStatus;
  requestedAt: string;
  startedAt: string | null;
  closedAt: string | null;
  updatedAt: string;
}

export interface CreateProjectInput {
  applicationId: string;
  name: string;
  description?: string;
  analysisType?: AnalysisType;
  analysisLevel?: AnalysisLevel;
  hasRemediation?: boolean;
  scopeIn?: string;
  scopeOut?: string;
  notes?: string;
}

export type UpdateProjectInput = Partial<Omit<CreateProjectInput, "applicationId">>;
