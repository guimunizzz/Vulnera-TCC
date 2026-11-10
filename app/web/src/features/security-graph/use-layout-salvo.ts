/**
 * use-layout-salvo.ts
 *
 * Lembra o layout escolhido no grafo, por navegador (localStorage). Preferência
 * de visualização de quem está olhando, não dado do produto: não vai para a API.
 *
 * QUEM USA
 * `cyber-graph.tsx` e `exposure-graph.tsx`.
 */

import { useState } from "react";
import { ehLayout, type LayoutId } from "./graph-layouts";

/** Layout salvo em `chave`; o padrão vale quando não há nada salvo ou o storage está bloqueado. */
export function useLayoutSalvo(chave: string, padrao: LayoutId = "hierarquico"): [LayoutId, (l: LayoutId) => void] {
  const [layout, setLayout] = useState<LayoutId>(() => {
    try {
      const salvo = window.localStorage.getItem(chave);
      return ehLayout(salvo) ? salvo : padrao;
    } catch {
      // localStorage lança em modo privado de alguns navegadores.
      return padrao;
    }
  });
  const salvar = (novo: LayoutId) => {
    setLayout(novo);
    try {
      window.localStorage.setItem(chave, novo);
    } catch {
      // Sem storage, a escolha vale só nesta visita.
    }
  };
  return [layout, salvar];
}
