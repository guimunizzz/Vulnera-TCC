/**
 * O que faz: fornece chamadas HTTP tipadas para a fila administrativa de acesso.
 * Por que existe: centraliza rotas e normalização de respostas sem expor credenciais.
 * Quem consome: a página administrativa de solicitações de acesso.
 */
import { apiClient } from "./client";
import type {
  AdminAccessRequest,
  AdminAccessRequestDetail,
  AdminAccessRequestEventsPage,
  AdminAccessRequestMutationResult,
  AdminAccessRequestPage,
  AdminAccessRequestStatus,
} from "../../types/admin-access-requests.types";

export interface AdminAccessRequestListParams {
  page?: number;
  pageSize?: number;
  status?: AdminAccessRequestStatus;
}

export interface AdminAccessRequestEventsParams {
  page?: number;
  pageSize?: number;
}

const base = "/admin/access-requests";
const encoded = (id: string) => encodeURIComponent(id);

export const adminAccessRequestsApi = {
  async list(params: AdminAccessRequestListParams = {}): Promise<AdminAccessRequestPage> {
    const { data } = await apiClient.get<AdminAccessRequestPage>(base, { params });
    return data;
  },
  async get(id: string): Promise<AdminAccessRequestDetail> {
    const { data } = await apiClient.get<AdminAccessRequestDetail>(`${base}/${encoded(id)}`);
    return data;
  },
  async events(id: string, params: AdminAccessRequestEventsParams = {}): Promise<AdminAccessRequestEventsPage> {
    const { data } = await apiClient.get<AdminAccessRequestEventsPage>(`${base}/${encoded(id)}/events`, { params });
    return data;
  },
  async approve(id: string): Promise<AdminAccessRequestMutationResult> {
    const { data } = await apiClient.post<AdminAccessRequestMutationResult>(`${base}/${encoded(id)}/approve`, {});
    return data;
  },
  async reject(id: string, input: { reason?: string | null }): Promise<{ request: AdminAccessRequest }> {
    const { data } = await apiClient.post<{ request: AdminAccessRequest }>(`${base}/${encoded(id)}/reject`, input);
    return data;
  },
  async resendInvitation(id: string): Promise<AdminAccessRequestMutationResult> {
    const { data } = await apiClient.post<AdminAccessRequestMutationResult>(`${base}/${encoded(id)}/resend-invitation`, {});
    return data;
  },
};
