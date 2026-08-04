import type { Company as PrismaCompany } from "@prisma/client";

// === TYPE ===================================================================
export type Company = PrismaCompany;

// === DTOs ===================================================================
export type CreateCompanyDTO = {
  name: string;
  cnpj?: string;
  planId: string;
};

export type UpdateCompanyDTO = Partial<CreateCompanyDTO>;

export type CompanyResponseDTO = {
  id: string;
  name: string;
  cnpj: string | null;
  planId: string;
  createdAt: string;
  updatedAt: string;
};

// === ENTITY =================================================================
export class CompanyEntity {
  constructor(private readonly data: Company) {}

  toResponse(): CompanyResponseDTO {
    return {
      id: this.data.id,
      name: this.data.name,
      cnpj: this.data.cnpj,
      planId: this.data.planId,
      createdAt: this.data.createdAt.toISOString(),
      updatedAt: this.data.updatedAt.toISOString(),
    };
  }
}
