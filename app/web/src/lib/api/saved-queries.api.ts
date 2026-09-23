import { apiClient } from "./client";
import type { SavedQuery, SavedQueryInput } from "../../types/saved-query.types";

/**
 * Buscas salvas e watchlists (CP-6).
 *
 * Não existe endpoint de "resultados da busca salva": abrir um atalho é
 * navegar para `/findings?<queryString>` e deixar a listagem responder com o
 * escopo de quem abriu.
 */
export const savedQueriesApi = {
  list: (apenasFixadas = false) =>
    apiClient.get<SavedQuery[]>(`/saved-queries${apenasFixadas ? "?pinned=true" : ""}`).then((r) => r.data),
  getById: (id: string) => apiClient.get<SavedQuery>(`/saved-queries/${id}`).then((r) => r.data),
  create: (input: SavedQueryInput) => apiClient.post<SavedQuery>("/saved-queries", input).then((r) => r.data),
  update: (id: string, input: Partial<SavedQueryInput>) =>
    apiClient.put<SavedQuery>(`/saved-queries/${id}`, input).then((r) => r.data),
  remove: (id: string) => apiClient.delete<void>(`/saved-queries/${id}`).then((r) => r.data),
};
