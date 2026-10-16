/**
 * Consultas read-only de vulnerabilidades com os DTOs reais da API.
 * Mantém paginação e facetas para não truncar listas nem inventar totais.
 * Consumidores: detalhes de projeto e de vulnerabilidade do cliente.
 */
import { apiClient } from "./client";
import type { Vulnerability, VulnerabilitySearchResponse } from "../types/vulnerability.types";

export const vulnerabilitiesApi = {
  listByProject: (projectId: string, page = 1, signal?: AbortSignal) =>
    apiClient.get<VulnerabilitySearchResponse>("/vulnerabilities", {
      params: { projectId, page, pageSize: 30, sortBy: "createdAt", sortOrder: "desc" }, signal,
    }).then((res) => res.data),
  getById: (id: string, signal?: AbortSignal) => apiClient.get<Vulnerability>(`/vulnerabilities/${id}`, { signal }).then((res) => res.data),
};
