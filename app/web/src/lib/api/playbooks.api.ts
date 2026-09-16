import { apiClient } from "./client";
import type { Playbook, PlaybookInput, PlaybookListItem } from "../../types/playbook.types";

/**
 * Catálogo de remediação (CP-5).
 *
 * Não existe `sync` aqui: a importação da OWASP é CLI
 * (`npm run sync:owasp-playbooks`), justamente para que uma indisponibilidade
 * do GitHub nunca vire uma indisponibilidade do Vulnera.
 */
export const playbooksApi = {
  list: (filtro: { owaspCategory?: string; search?: string; source?: "OWASP_TOP10" | "CUSTOM" } = {}) => {
    const params = new URLSearchParams();
    if (filtro.owaspCategory) params.set("owaspCategory", filtro.owaspCategory);
    if (filtro.search) params.set("search", filtro.search);
    if (filtro.source) params.set("source", filtro.source);
    const qs = params.toString();
    return apiClient.get<PlaybookListItem[]>(`/playbooks${qs ? `?${qs}` : ""}`).then((r) => r.data);
  },

  getById: (id: string) => apiClient.get<Playbook>(`/playbooks/${id}`).then((r) => r.data),

  /** O bloco "Como corrigir" do finding: custom do tenant primeiro, System depois. */
  forCategory: (owaspCategory: string, companyId: string) =>
    apiClient
      .get<PlaybookListItem[]>(`/playbooks/for-category/${owaspCategory}?companyId=${encodeURIComponent(companyId)}`)
      .then((r) => r.data),

  create: (input: PlaybookInput) => apiClient.post<Playbook>("/playbooks", input).then((r) => r.data),

  update: (id: string, input: Partial<PlaybookInput>) =>
    apiClient.put<Playbook>(`/playbooks/${id}`, input).then((r) => r.data),

  /** "Duplicar e adaptar" — a forma de partir do conteúdo OWASP sem editá-lo. */
  clone: (id: string, title?: string) =>
    apiClient.post<Playbook>(`/playbooks/${id}/clone`, title ? { title } : {}).then((r) => r.data),

  remove: (id: string) => apiClient.delete<void>(`/playbooks/${id}`).then((r) => r.data),
};
