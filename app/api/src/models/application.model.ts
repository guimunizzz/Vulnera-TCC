import type { Application as PrismaApplication } from "@prisma/client";

// === TYPE ===================================================================
export type Application = PrismaApplication;

// === DTOs ===================================================================
// companyId NUNCA entra aqui — é sempre derivado do req.user no service
// (anti-pattern do CLAUDE.md §14: "aceitar companyId vindo do body").
export type CreateApplicationDTO = {
  name: string;
  url?: string;
  environment?: string; // PROD | HOMOL | DEV — default PROD
  techStack?: string;
  description?: string;
};

export type UpdateApplicationDTO = Partial<CreateApplicationDTO>;

export type ApplicationResponseDTO = {
  id: string;
  name: string;
  url: string | null;
  environment: string;
  techStack: string | null;
  description: string | null;
  companyId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

// === ENTITY =================================================================
export class ApplicationEntity {
  constructor(private readonly data: Application) {}

  toResponse(): ApplicationResponseDTO {
    return {
      id: this.data.id,
      name: this.data.name,
      url: this.data.url,
      environment: this.data.environment,
      techStack: this.data.techStack,
      description: this.data.description,
      companyId: this.data.companyId,
      isActive: this.data.isActive,
      createdAt: this.data.createdAt.toISOString(),
      updatedAt: this.data.updatedAt.toISOString(),
    };
  }
}
