import { apiClient } from "./client";
import type { Company, CreateCompanyInput } from "../../types/company.types";

export const companiesApi = {
  create: (input: CreateCompanyInput) => apiClient.post<Company>("/companies", input).then((res) => res.data),
  me: () => apiClient.get<Company>("/companies/me").then((res) => res.data),
  /** Admin-only no backend — usado na tela de aprovação de assinaturas pra resolver nome da empresa. */
  list: () => apiClient.get<Company[]>("/companies").then((res) => res.data),
};
