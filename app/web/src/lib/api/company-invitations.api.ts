/**
 * O que faz: encapsula os endpoints de equipe e convites empresariais.
 * Por que existe: mantém payloads e rotas do domínio tipados em um só lugar.
 * Quem consome: CompanyTeamPage e JoinCompanyPage.
 */
import { apiClient } from "./client";
import { publicPost } from "./public-http";
import type {
  CompanyInvitation,
  CompanyInvitationHistoryEvent,
  CompanyInvitationMutationResult,
  CompanyMember,
} from "../../types/company-invitations.types";

const root = "/companies/me/invitations";
const idPath = (id: string) => encodeURIComponent(id);

export const companyInvitationsApi = {
  listMembers: () => apiClient.get<CompanyMember[]>("/companies/me/members").then((res) => res.data),
  list: () => apiClient.get<CompanyInvitation[]>(root).then((res) => res.data),
  history: () => apiClient.get<CompanyInvitationHistoryEvent[]>(`${root}/history`).then((res) => res.data),
  create: (input: { name: string; email: string }) => apiClient.post<CompanyInvitationMutationResult>(root, input).then((res) => res.data),
  resend: (id: string) => apiClient.post<CompanyInvitationMutationResult>(`${root}/${idPath(id)}/resend`, {}).then((res) => res.data),
  revoke: (id: string) => apiClient.delete<void>(`${root}/${idPath(id)}`).then((res) => res.data),
  deactivateMember: (id: string) => apiClient.delete<void>(`/companies/me/members/${idPath(id)}`).then((res) => res.data),
  validatePublic: (token: string) => publicPost<{ valid: boolean }>("/company-invitations/validate", { token }),
  activatePublic: (input: { token: string; password: string }) => publicPost<void>("/company-invitations/activate", input),
};
