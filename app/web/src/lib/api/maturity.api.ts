/**
 * maturity.api.ts
 *
 * getLatestByCompany devolve null apenas quando o servidor confirma que a
 * empresa ainda não tem avaliação — é um estado normal da tela
 * (empresa nova / admin ainda não preencheu), não um erro a tratar no
 * componente.
 */

import axios from "axios";
import { apiClient } from "./client";
import type { MaturityAssessment, MaturityDomain, ScoreInput } from "../../types/maturity.types";

export const maturityApi = {
  getCatalog: () => apiClient.get<MaturityDomain[]>("/maturity/catalog").then((res) => res.data),

  createAssessment: (companyId: string) =>
    apiClient.post<MaturityAssessment>("/maturity/assessments", { companyId }).then((res) => res.data),

  submitScores: (assessmentId: string, scores: ScoreInput[]) =>
    apiClient
      .post<MaturityAssessment>(`/maturity/assessments/${assessmentId}/scores`, { scores })
      .then((res) => res.data),

  getLatestByCompany: async (companyId: string): Promise<MaturityAssessment | null> => {
    try {
      const res = await apiClient.get<MaturityAssessment>(`/maturity/assessments/${companyId}/latest`);
      return res.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404 && error.response.data?.error === "ASSESSMENT_NOT_FOUND") {
        return null;
      }
      throw error;
    }
  },
};
