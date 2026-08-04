import type { Project as PrismaProject } from "@prisma/client";

// === TYPE ===================================================================
export type Project = PrismaProject;

export type ProjectStatus = "PENDING" | "IN_PROGRESS" | "IN_REVIEW" | "COMPLETED";

// === DTOs ===================================================================
// companyId nunca entra aqui — RN06: é sempre herdado da Application no service.
export type CreateProjectDTO = {
  applicationId: string;
  name: string;
  description?: string;
  analysisType?: string; // SAST | DAST | MATURITY | COMBO — default DAST
  analysisLevel?: string; // BASIC | INTERMEDIATE | ADVANCED — default BASIC
  hasRemediation?: boolean;
  scopeIn?: string;
  scopeOut?: string;
  notes?: string;
};

export type UpdateProjectDTO = Partial<Omit<CreateProjectDTO, "applicationId">>;

export type TransitionProjectDTO = {
  toStatus: ProjectStatus;
};

export type ProjectResponseDTO = {
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
};

// === ENTITY =================================================================
export class ProjectEntity {
  constructor(private readonly data: Project) {}

  toResponse(): ProjectResponseDTO {
    return {
      id: this.data.id,
      name: this.data.name,
      description: this.data.description,
      applicationId: this.data.applicationId,
      companyId: this.data.companyId,
      analysisType: this.data.analysisType,
      analysisLevel: this.data.analysisLevel,
      hasRemediation: this.data.hasRemediation,
      scopeIn: this.data.scopeIn,
      scopeOut: this.data.scopeOut,
      notes: this.data.notes,
      status: this.data.status as ProjectStatus,
      requestedAt: this.data.requestedAt.toISOString(),
      startedAt: this.data.startedAt ? this.data.startedAt.toISOString() : null,
      closedAt: this.data.closedAt ? this.data.closedAt.toISOString() : null,
      updatedAt: this.data.updatedAt.toISOString(),
    };
  }
}
