import { apiClient } from "./client";
import type {
  CreateVulnerabilityInput,
  FindingSearchResponse,
  UpdateVulnerabilityInput,
  Vulnerability,
  VulnerabilitySeverity,
  VulnerabilityStatus,
} from "../../types/vulnerability.types";
import type { AuditLogEntry } from "../../types/audit-log.types";

/** Teto do backend. Repetido aqui só pra evitar pedir o que será clampado. */
export const FINDINGS_PAGE_SIZE_MAX = 100;

export const vulnerabilitiesApi = {
  /**
   * Listagem global com filtros, paginação e facetas.
   *
   * ⚠️ Recebe `URLSearchParams` pronto, não um objeto: quem monta é
   * `finding-query.ts`, e listas viajam separadas por vírgula
   * (`severity=HIGH,CRITICAL`). Passar um objeto pro axios faria ele
   * serializar arrays como `severity[]=`, que é outra forma — o backend
   * aceita as duas, mas ter uma só no cliente evita dois vocabulários.
   *
   * O escopo por papel é resolvido no backend (ADMIN=tudo, CLIENT=própria
   * company por RN16, PENTESTER=projetos onde é membro por RN17).
   */
  search: (params: URLSearchParams) =>
    apiClient.get<FindingSearchResponse>(`/vulnerabilities?${params.toString()}`).then((res) => res.data),
  getById: (id: string) => apiClient.get<Vulnerability>(`/vulnerabilities/${id}`).then((res) => res.data),
  /** Trilha de auditoria do finding — criação, transições, overrides. */
  auditLog: (id: string) =>
    apiClient.get<AuditLogEntry[]>(`/vulnerabilities/${id}/audit-log`).then((res) => res.data),
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
