/**
 * evidences.api.ts
 *
 * upload() manda multipart/form-data com barra de progresso (onUploadProgress
 * do Axios). download() busca o arquivo como Blob — não dá pra usar um
 * <a href> direto porque o endpoint exige Authorization: Bearer (nunca se
 * põe token de acesso em query string).
 */

import { apiClient } from "./client";
import type { Evidence } from "../../types/evidence.types";

export const evidencesApi = {
  list: (vulnerabilityId: string) =>
    apiClient.get<Evidence[]>(`/vulnerabilities/${vulnerabilityId}/evidences`).then((res) => res.data),

  upload: (vulnerabilityId: string, file: File, proof: string, onProgress?: (percent: number) => void) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("proof", proof);
    return apiClient
      .post<Evidence>(`/vulnerabilities/${vulnerabilityId}/evidences`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (event) => {
          if (onProgress && event.total) onProgress(Math.round((event.loaded / event.total) * 100));
        },
      })
      .then((res) => res.data);
  },

  download: (vulnerabilityId: string, evidenceId: string) =>
    apiClient
      .get<Blob>(`/vulnerabilities/${vulnerabilityId}/evidences/${evidenceId}`, { responseType: "blob" })
      .then((res) => res.data),
};
