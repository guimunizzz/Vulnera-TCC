/**
 * code-imports.api.ts — importações SAST/SCA (ADR-052).
 *
 * `importReport` manda multipart (campo "file" + "projectId"). O companyId
 * nunca vai no request: a API herda do projeto.
 */

import { apiClient } from "./client";
import type {
  CodeFinding,
  CodeImportComparison,
  CodeImportReportData,
  CodePromoteInput,
  CodePromotionDraft,
  CodeScanImport,
} from "../../types/code-import.types";
import type { DastTriageStatus } from "../../types/dast.types";
import type { Vulnerability } from "../../types/vulnerability.types";

export const codeImportsApi = {
  /** Sem projectId: importações de todos os projetos que o usuário enxerga. */
  list: (projectId?: string) =>
    apiClient.get<CodeScanImport[]>("/code-imports", { params: projectId ? { projectId } : undefined }).then((res) => res.data),

  getById: (id: string) => apiClient.get<CodeScanImport>(`/code-imports/${id}`).then((res) => res.data),

  importReport: (projectId: string, file: File, onProgress?: (percent: number) => void) => {
    const formData = new FormData();
    formData.append("projectId", projectId);
    formData.append("file", file);
    return apiClient
      .post<CodeScanImport>("/code-imports", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (event) => {
          if (onProgress && event.total) onProgress(Math.round((event.loaded / event.total) * 100));
        },
      })
      .then((res) => res.data);
  },

  listFindings: (id: string) => apiClient.get<CodeFinding[]>(`/code-imports/${id}/findings`).then((res) => res.data),

  compare: (id: string) => apiClient.get<CodeImportComparison>(`/code-imports/${id}/compare`).then((res) => res.data),

  getReportData: (id: string) => apiClient.get<CodeImportReportData>(`/code-imports/${id}/report/data`).then((res) => res.data),

  /* Rotas sob /code-imports/findings/... — literal antes do "/:id" no backend. */
  triage: (findingId: string, triageStatus: DastTriageStatus, note: string | null) =>
    apiClient.patch<CodeFinding>(`/code-imports/findings/${findingId}/triage`, { triageStatus, note }).then((res) => res.data),

  getPromotionDraft: (findingId: string) =>
    apiClient.get<CodePromotionDraft>(`/code-imports/findings/${findingId}/promotion-draft`).then((res) => res.data),

  promote: (findingId: string, input: CodePromoteInput) =>
    apiClient.post<Vulnerability>(`/code-imports/findings/${findingId}/promote`, input).then((res) => res.data),
};
