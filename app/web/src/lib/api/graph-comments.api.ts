import { apiClient } from "./client";
import type { ComentarioDoGrafo, GrafoComentavel, NovoComentarioDoGrafo } from "../../types/graph-comment.types";

export const graphCommentsApi = {
  async listar(grafo: GrafoComentavel, escopo?: string): Promise<ComentarioDoGrafo[]> {
    const { data } = await apiClient.get<ComentarioDoGrafo[]>("/graph-comments", { params: { grafo, escopo } });
    return data;
  },

  async criar(entrada: NovoComentarioDoGrafo): Promise<ComentarioDoGrafo> {
    const { data } = await apiClient.post<ComentarioDoGrafo>("/graph-comments", entrada);
    return data;
  },

  async apagar(id: string): Promise<void> {
    await apiClient.delete(`/graph-comments/${encodeURIComponent(id)}`);
  },
};
