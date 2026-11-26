/**
 * fila-de-triagem.ts
 *
 * O QUE FAZ
 * As regras da triagem por teclado (ADR-062), puras e testadas: qual tecla é
 * qual ação, andar na fila, tirar o item decidido (o próximo assume o lugar)
 * e desfazer a última decisão (o item volta para onde estava).
 *
 * ATALHOS (inspirados no Linear e no Gmail)
 *   j / ↓   próximo            a   confirmar
 *   k / ↑   anterior           f   falso positivo
 *   Enter   abrir no contexto  r   risco aceito
 *   n       escrever nota      u   desfazer a última
 *   ?       ajuda
 * Teclas digitadas num campo (a nota) não viram ação; com Ctrl/Cmd/Alt
 * também não (são atalhos do navegador).
 *
 * QUEM USA
 * `pages/triage-page.tsx`. Testado em `fila-de-triagem.test.ts`.
 */

import type { ItemDaCaixa } from "../types/triage.types";

export type Decisao = "CONFIRMED" | "FALSE_POSITIVE" | "ACCEPTED_RISK";

export type AcaoDaFila =
  | { tipo: "mover"; delta: 1 | -1 }
  | { tipo: "decidir"; decisao: Decisao }
  | { tipo: "desfazer" }
  | { tipo: "abrir" }
  | { tipo: "nota" }
  | { tipo: "ajuda" };

export const ROTULO_DA_DECISAO: Record<Decisao, string> = {
  CONFIRMED: "Confirmado",
  FALSE_POSITIVE: "Falso positivo",
  ACCEPTED_RISK: "Risco aceito",
};

export function teclaParaAcao(evento: { key: string; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean }, digitandoEmCampo: boolean): AcaoDaFila | null {
  if (digitandoEmCampo || evento.ctrlKey || evento.metaKey || evento.altKey) return null;
  switch (evento.key) {
    case "j":
    case "ArrowDown":
      return { tipo: "mover", delta: 1 };
    case "k":
    case "ArrowUp":
      return { tipo: "mover", delta: -1 };
    case "a":
      return { tipo: "decidir", decisao: "CONFIRMED" };
    case "f":
      return { tipo: "decidir", decisao: "FALSE_POSITIVE" };
    case "r":
      return { tipo: "decidir", decisao: "ACCEPTED_RISK" };
    case "u":
      return { tipo: "desfazer" };
    case "Enter":
    case "o":
      return { tipo: "abrir" };
    case "n":
      return { tipo: "nota" };
    case "?":
      return { tipo: "ajuda" };
    default:
      return null;
  }
}

export interface Decidido {
  item: ItemDaCaixa;
  indice: number;
  decisao: Decisao;
}

export interface EstadoDaFila {
  itens: ItemDaCaixa[];
  ativo: number;
  /** As decisões desta sessão, a mais recente por último (para o "u"). */
  historico: Decidido[];
}

export const filaInicial = (itens: ItemDaCaixa[]): EstadoDaFila => ({ itens, ativo: 0, historico: [] });

export function mover(estado: EstadoDaFila, delta: number): EstadoDaFila {
  if (estado.itens.length === 0) return estado;
  return { ...estado, ativo: Math.max(0, Math.min(estado.itens.length - 1, estado.ativo + delta)) };
}

/** Tira o item ativo da fila; o próximo ocupa o lugar (no fim, o anterior). */
export function decidir(estado: EstadoDaFila, decisao: Decisao): { estado: EstadoDaFila; decidido: Decidido | null } {
  const item = estado.itens[estado.ativo];
  if (!item) return { estado, decidido: null };
  const itens = estado.itens.filter((_, i) => i !== estado.ativo);
  const decidido = { item, indice: estado.ativo, decisao };
  return {
    estado: { itens, ativo: Math.min(estado.ativo, Math.max(0, itens.length - 1)), historico: [...estado.historico, decidido] },
    decidido,
  };
}

/** Devolve o último decidido ao lugar de onde saiu, já ativo. */
export function desfazer(estado: EstadoDaFila): { estado: EstadoDaFila; desfeito: Decidido | null } {
  const desfeito = estado.historico[estado.historico.length - 1];
  if (!desfeito) return { estado, desfeito: null };
  const indice = Math.min(desfeito.indice, estado.itens.length);
  const itens = [...estado.itens.slice(0, indice), desfeito.item, ...estado.itens.slice(indice)];
  return { estado: { itens, ativo: indice, historico: estado.historico.slice(0, -1) }, desfeito };
}

/** Se a chamada da decisão falhar, o item volta (mesmo efeito do desfazer, sem tocar no histórico alheio). */
export function reverterDecisao(estado: EstadoDaFila, decidido: Decidido): EstadoDaFila {
  const historico = estado.historico.filter((d) => d !== decidido);
  if (estado.itens.some((i) => i.id === decidido.item.id)) return { ...estado, historico };
  const indice = Math.min(decidido.indice, estado.itens.length);
  return { itens: [...estado.itens.slice(0, indice), decidido.item, ...estado.itens.slice(indice)], ativo: indice, historico };
}
