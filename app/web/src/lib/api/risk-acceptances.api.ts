import { apiClient } from "./client";
import type { RiskAcceptance, RequestRiskAcceptanceInput } from "../../types/risk-acceptance.types";

/**
 * Aceite formal de risco (CP-4). Listar e solicitar são sub-recursos do
 * finding; decidir (aprovar/rejeitar/revogar) age sobre o aceite, que já tem
 * id próprio. Não existe `update`: aceite decidido é imutável.
 */
export const riskAcceptancesApi = {
  listByVulnerability: (vulnerabilityId: string) =>
    apiClient.get<RiskAcceptance[]>(`/vulnerabilities/${vulnerabilityId}/risk-acceptances`).then((r) => r.data),
  request: (vulnerabilityId: string, input: RequestRiskAcceptanceInput) =>
    apiClient.post<RiskAcceptance>(`/vulnerabilities/${vulnerabilityId}/risk-acceptances`, input).then((r) => r.data),
  approve: (id: string, input: { expiresAt: string; reviewNote?: string | null }) =>
    apiClient.post<RiskAcceptance>(`/risk-acceptances/${id}/approve`, input).then((r) => r.data),
  reject: (id: string, input: { reviewNote: string }) =>
    apiClient.post<RiskAcceptance>(`/risk-acceptances/${id}/reject`, input).then((r) => r.data),
  revoke: (id: string, input: { reason: string }) =>
    apiClient.post<RiskAcceptance>(`/risk-acceptances/${id}/revoke`, input).then((r) => r.data),
};
