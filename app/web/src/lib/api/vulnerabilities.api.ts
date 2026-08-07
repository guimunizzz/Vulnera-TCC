import { apiClient } from "./client";
import type {
  CreateVulnerabilityInput,
  UpdateVulnerabilityInput,
  Vulnerability,
  VulnerabilitySeverity,
  VulnerabilityStatus,
} from "../../types/vulnerability.types";

export const vulnerabilitiesApi = {
  /** Sem projectId — GET /vulnerabilities "cru". Escopo já vem resolvido pelo backend por role (ADMIN=tudo, CLIENT=própria company, PENTESTER=projetos onde é membro) — usado pelos dashboards. */
  list: () => apiClient.get<Vulnerability[]>("/vulnerabilities").then((res) => res.data),
  listByProject: (projectId: string) =>
    apiClient.get<Vulnerability[]>("/vulnerabilities", { params: { projectId } }).then((res) => res.data),
  getById: (id: string) => apiClient.get<Vulnerability>(`/vulnerabilities/${id}`).then((res) => res.data),
  create: (input: CreateVulnerabilityInput) =>
    apiClient.post<Vulnerability>("/vulnerabilities", input).then((res) => res.data),
  update: (id: string, input: UpdateVulnerabilityInput) =>
    apiClient.put<Vulnerability>(`/vulnerabilities/${id}`, input).then((res) => res.data),
  transition: (id: string, toStatus: VulnerabilityStatus) =>
    apiClient.post<Vulnerability>(`/vulnerabilities/${id}/transition`, { toStatus }).then((res) => res.data),
  overrideSeverity: (id: string, newSeverity: VulnerabilitySeverity, justification: string) =>
    apiClient
      .post<Vulnerability>(`/vulnerabilities/${id}/override-severity`, { newSeverity, justification })
      .then((res) => res.data),
  delete: (id: string) => apiClient.delete<void>(`/vulnerabilities/${id}`).then((res) => res.data),
};
