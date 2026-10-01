import { apiClient } from "./client";
import type { SlaPolicy, UpsertSlaPolicyInput } from "../../types/sla-policy.types";

/**
 * Política de SLA (CP-2) — sub-recurso de Company. `get` devolve a vigente
 * (a da empresa ou a padrão do produto, marcada com `isDefault`); `upsert`
 * versiona; `apply` é ADMIN-only e recalcula os findings ativos.
 */
export const slaPolicyApi = {
  get: (companyId: string) => apiClient.get<SlaPolicy>(`/companies/${companyId}/sla-policy`).then((r) => r.data),
  history: (companyId: string) =>
    apiClient.get<SlaPolicy[]>(`/companies/${companyId}/sla-policy/history`).then((r) => r.data),
  upsert: (companyId: string, input: UpsertSlaPolicyInput) =>
    apiClient.put<SlaPolicy>(`/companies/${companyId}/sla-policy`, input).then((r) => r.data),
  apply: (companyId: string) =>
    apiClient
      .post<{ recalculated: number; policyId: string | null }>(`/companies/${companyId}/sla-policy/apply`)
      .then((r) => r.data),
};
