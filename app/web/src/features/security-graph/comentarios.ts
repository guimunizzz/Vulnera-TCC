/**
 * comentarios.ts — helpers dos comentários de nó (ADR-061), fora do arquivo do
 * componente para o fast refresh do Vite continuar funcionando.
 */

import type { ComentarioDoGrafo, GrafoComentavel } from "../../types/graph-comment.types";

/** Chave da consulta dos comentários de um grafo — a página e este componente usam a mesma. */
export const chaveDosComentarios = (grafo: GrafoComentavel, escopo?: string) => ["graph-comments", grafo, escopo ?? "empresa"] as const;

/** Contagem por nó, para o selo do grafo. */
export function contarPorNo(comentarios: ComentarioDoGrafo[] | undefined): Map<string, number> {
  const mapa = new Map<string, number>();
  for (const c of comentarios ?? []) mapa.set(c.nodeId, (mapa.get(c.nodeId) ?? 0) + 1);
  return mapa;
}
