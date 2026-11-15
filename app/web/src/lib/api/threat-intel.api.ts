/**
 * threat-intel.api.ts — Threat Intel (ADR-053) e a central de notificações.
 *
 * `companyId` vai na query para ADMIN e PENTESTER (que escolhem a empresa); a
 * API ignora o parâmetro para CLIENT e usa a empresa dele.
 */

import { apiClient } from "./client";
import type {
  AtivoTI,
  AvisoDoFeed,
  CasamentoTI,
  EmpresaTI,
  ExecucaoSync,
  Notificacao,
  NovoAtivoInput,
  ProdutoCpe,
  PromoverTIInput,
  RascunhoPromocaoTI,
  ResumoTI,
} from "../../types/threat-intel.types";
import type { DastTriageStatus } from "../../types/dast.types";
import type { Vulnerability } from "../../types/vulnerability.types";

const q = (companyId: string | undefined, extra: Record<string, string | undefined> = {}) => ({
  params: Object.fromEntries(Object.entries({ companyId, ...extra }).filter(([, v]) => v !== undefined && v !== "")),
});

export const threatIntelApi = {
  companies: () => apiClient.get<EmpresaTI[]>("/threat-intel/companies").then((r) => r.data),
  overview: (companyId?: string) => apiClient.get<ResumoTI>("/threat-intel/overview", q(companyId)).then((r) => r.data),

  assets: (companyId?: string, status?: string) => apiClient.get<AtivoTI[]>("/threat-intel/assets", q(companyId, { status })).then((r) => r.data),
  addAsset: (input: NovoAtivoInput) => apiClient.post<AtivoTI>("/threat-intel/assets", input).then((r) => r.data),
  removeAsset: (id: string) => apiClient.delete(`/threat-intel/assets/${id}`).then(() => undefined),
  confirmAsset: (id: string) => apiClient.post<AtivoTI>(`/threat-intel/assets/${id}/confirm`).then((r) => r.data),
  dismissAsset: (id: string) => apiClient.post<AtivoTI>(`/threat-intel/assets/${id}/dismiss`).then((r) => r.data),
  confirmAll: (companyId?: string) => apiClient.post<{ confirmadas: number }>("/threat-intel/assets/confirm-all", { companyId }).then((r) => r.data),
  searchProducts: (termo: string, companyId?: string) =>
    apiClient.get<ProdutoCpe[]>("/threat-intel/assets/search-products", q(companyId, { q: termo })).then((r) => r.data),

  matches: (companyId?: string, filtros: { triage?: string; kev?: boolean; severity?: string } = {}) =>
    apiClient
      .get<CasamentoTI[]>("/threat-intel/matches", q(companyId, { triage: filtros.triage, kev: filtros.kev ? "true" : undefined, severity: filtros.severity }))
      .then((r) => r.data),
  triage: (id: string, triageStatus: DastTriageStatus, note: string | null) =>
    apiClient.patch<CasamentoTI>(`/threat-intel/matches/${id}/triage`, { triageStatus, note }).then((r) => r.data),
  promotionDraft: (id: string) => apiClient.get<RascunhoPromocaoTI>(`/threat-intel/matches/${id}/promotion-draft`).then((r) => r.data),
  promote: (id: string, input: PromoverTIInput) => apiClient.post<Vulnerability>(`/threat-intel/matches/${id}/promote`, input).then((r) => r.data),

  feed: (companyId?: string, filtros: { days?: number; kev?: boolean; severity?: string } = {}) =>
    apiClient
      .get<AvisoDoFeed[]>("/threat-intel/feed", q(companyId, { days: filtros.days ? String(filtros.days) : undefined, kev: filtros.kev ? "true" : undefined, severity: filtros.severity }))
      .then((r) => r.data),

  syncStatus: (companyId?: string) =>
    apiClient.get<{ sincronizando: boolean; execucoes: ExecucaoSync[] }>("/threat-intel/sync", q(companyId)).then((r) => r.data),
  syncNow: () => apiClient.post<{ iniciada: boolean }>("/threat-intel/sync").then((r) => r.data),
};

export const notificationsApi = {
  list: (apenasNaoLidas = false) =>
    apiClient.get<{ data: Notificacao[]; naoLidas: number }>("/notifications", { params: apenasNaoLidas ? { unread: "true" } : undefined }).then((r) => r.data),
  unreadCount: () => apiClient.get<{ naoLidas: number }>("/notifications/unread-count").then((r) => r.data),
  markRead: (id: string) => apiClient.post(`/notifications/${id}/read`).then(() => undefined),
  markAllRead: () => apiClient.post<{ marcadas: number }>("/notifications/read-all").then((r) => r.data),
};
