export interface Company {
  id: string;
  name: string;
  cnpj: string | null;
  planId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCompanyInput {
  name: string;
  cnpj?: string;
  planId: string;
}
