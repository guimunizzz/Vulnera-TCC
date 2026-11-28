/**
 * graph-comment.types.ts — contrato de /api/graph-comments (ADR-061).
 */

export type GrafoComentavel = "EXPOSURE" | "DAST_SCAN";

export interface ComentarioDoGrafo {
  id: string;
  nodeId: string;
  body: string;
  createdAt: string;
  autor: { id: string; name: string };
  podeApagar: boolean;
}

export interface NovoComentarioDoGrafo {
  grafo: GrafoComentavel;
  /** Id do scan (DAST_SCAN); o Exposure Graph usa a company do usuário. */
  escopo?: string;
  noId: string;
  texto: string;
  /** Nome do nó como a tela mostra, para a notificação. */
  rotulo?: string;
}
