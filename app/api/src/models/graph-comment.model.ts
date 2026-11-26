/**
 * graph-comment.model.ts
 *
 * O QUE FAZ
 * Tipos, DTOs e a validação pura dos comentários fixados em nós de grafo
 * (ADR-061): o Exposure Graph da company e o CyberGraph de um scan DAST.
 *
 * QUEM USA
 * `graph-comment.service.ts` e os testes de unidade.
 */

export const GRAFOS_COMENTAVEIS = ["EXPOSURE", "DAST_SCAN"] as const;
export type GrafoComentavel = (typeof GRAFOS_COMENTAVEIS)[number];

export const TAMANHO_MAXIMO_DO_COMENTARIO = 2000;
export const TAMANHO_MAXIMO_DO_NO = 200;
/** Rótulo do nó só entra no texto da notificação: curto e sem quebra. */
export const TAMANHO_MAXIMO_DO_ROTULO = 120;

export interface ComentarioDoGrafoDTO {
  id: string;
  nodeId: string;
  body: string;
  createdAt: string;
  autor: { id: string; name: string };
  /** O ator pode apagar (é o autor ou é ADMIN). */
  podeApagar: boolean;
}

export interface NovoComentarioEntrada {
  grafo: GrafoComentavel;
  escopo: string | null;
  noId: string;
  texto: string;
  /** Nome do nó como a tela mostra; só para a mensagem da notificação. */
  rotulo: string | null;
}

/** Caracteres de controle (exceto quebra de linha e tab) não entram em texto salvo. */
const CONTROLE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
/** O mesmo conjunto sem `g`: `.test()` com `g` guarda estado entre chamadas. */
const TEM_CONTROLE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

/**
 * Valida e normaliza o corpo do POST. Lança o código de erro do projeto
 * (`INVALID_<CAMPO>` / `MISSING_<CAMPO>`); o service decide o escopo depois.
 */
export function validarNovoComentario(corpo: unknown): NovoComentarioEntrada {
  const c = (corpo ?? {}) as Record<string, unknown>;
  if (typeof c.grafo !== "string" || !(GRAFOS_COMENTAVEIS as readonly string[]).includes(c.grafo)) throw new Error("INVALID_GRAPH_KIND");
  if (typeof c.noId !== "string" || !c.noId.trim()) throw new Error("MISSING_NODE_ID");
  const noId = c.noId.trim();
  if (noId.length > TAMANHO_MAXIMO_DO_NO || TEM_CONTROLE.test(noId)) throw new Error("INVALID_NODE_ID");
  if (typeof c.texto !== "string" || !c.texto.trim()) throw new Error("MISSING_COMMENT_BODY");
  const texto = c.texto.replace(CONTROLE, "").trim();
  if (!texto) throw new Error("MISSING_COMMENT_BODY");
  if (texto.length > TAMANHO_MAXIMO_DO_COMENTARIO) throw new Error("INVALID_COMMENT_BODY");
  const escopo = typeof c.escopo === "string" && c.escopo.trim() ? c.escopo.trim() : null;
  if (c.grafo === "DAST_SCAN" && !escopo) throw new Error("MISSING_SCOPE");
  const rotulo = typeof c.rotulo === "string" ? c.rotulo.replace(CONTROLE, "").replace(/\s+/g, " ").trim().slice(0, TAMANHO_MAXIMO_DO_ROTULO) || null : null;
  return { grafo: c.grafo as GrafoComentavel, escopo, noId, texto, rotulo };
}

/** Para onde a notificação leva: a tela do grafo, com o nó já pedido na URL. */
export function linkDoComentario(grafo: GrafoComentavel, scopeId: string, noId: string): string {
  const no = encodeURIComponent(noId);
  return grafo === "EXPOSURE" ? `/exposure-graph?no=${no}` : `/dast/scans/${encodeURIComponent(scopeId)}?no=${no}`;
}
