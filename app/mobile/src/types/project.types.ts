// Espelha app/web/src/types/project.types.ts — só os campos que o mobile
// read-only realmente usa (Home + ProjectDetail).

export type ProjectStatus = "PENDING" | "IN_PROGRESS" | "IN_REVIEW" | "COMPLETED";

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
