/**
 * use-lista-navegavel.ts
 *
 * O QUE FAZ
 * A navegação por teclado de qualquer lista de opções: setas, Home/End, e
 * digitação para saltar ao item (typeahead).
 *
 * POR QUE EXISTE
 * É o comportamento que `@radix-ui/react-select` e os menus do Radix davam de
 * graça, e é a parte que mais regride quando se troca uma biblioteca acessível
 * por componentes próprios (ADR-023). Concentrado num hook, ele é testado uma
 * vez e herdado por `Select`, `Combobox`, `DropdownMenu` e `ContextMenu`.
 *
 * ESTRATÉGIA DE FOCO: `aria-activedescendant`
 * O foco do DOM fica no CONTAINER (a caixa de busca do Combobox, ou o próprio
 * `<div role="listbox">`); qual item está "ativo" é comunicado por
 * `aria-activedescendant`, apontando para o id do item.
 *
 * A alternativa seria roving tabindex — mover o foco real de item em item. Foi
 * descartada por um motivo concreto: no Combobox, mover o foco para o item
 * tiraria o foco do campo de texto, e a pessoa não conseguiria continuar
 * digitando. Com `activedescendant` o campo mantém o foco e o leitor de tela
 * anuncia o item ativo do mesmo jeito.
 *
 * ⚠️ Quem consome PRECISA:
 *   - dar `id` a cada item (use `idDoItem`)
 *   - pôr `aria-activedescendant={idAtivo}` no container focado
 *   - marcar `aria-selected` no item ativo
 * Sem isso o leitor de tela fica mudo — a navegação visual funciona e a
 * acessível não, que é o pior dos mundos porque parece que está tudo certo.
 *
 * QUEM USA
 * `Select`, `Combobox`, `DropdownMenu`, `ContextMenu`.
 */

import { useCallback, useEffect, useRef, useState } from "react";

export interface OpcoesListaNavegavel<T> {
  itens: T[];
  /** Texto usado pelo typeahead. */
  rotuloDe: (item: T) => string;
  /** Item desabilitado é pulado pelas setas. */
  desabilitado?: (item: T) => boolean;
  /** Chamado ao confirmar com Enter/Espaço. */
  aoEscolher?: (item: T, indice: number) => void;
  /** Fechar/cancelar (Escape é tratado pelo `useDismiss`, este é o Tab). */
  aoCancelar?: () => void;
  /** Voltar ao primeiro depois do último. Padrão `true`. */
  circular?: boolean;
  /** Índice inicialmente ativo. -1 = nenhum. */
  indiceInicial?: number;
  /** Prefixo dos ids gerados — precisa ser único na página. */
  idBase: string;
}

export interface ListaNavegavel {
  indiceAtivo: number;
  definirIndiceAtivo: (i: number) => void;
  /** Repassar no `onKeyDown` do container focado. */
  aoTeclar: (e: React.KeyboardEvent) => void;
  /** id do item ativo — vai em `aria-activedescendant`. */
  idAtivo: string | undefined;
  /** id de um item pelo índice — vai no `id` do item. */
  idDoItem: (i: number) => string;
  /** Ref do container rolável, para manter o item ativo à vista. */
  refLista: React.RefObject<HTMLDivElement>;
}

/** Tempo até o buffer de digitação zerar. 500ms é o valor usado pelo Windows. */
const JANELA_TYPEAHEAD_MS = 500;

export function useListaNavegavel<T>({
  itens,
  rotuloDe,
  desabilitado,
  aoEscolher,
  aoCancelar,
  circular = true,
  indiceInicial = -1,
  idBase,
}: OpcoesListaNavegavel<T>): ListaNavegavel {
  const [indiceAtivo, setIndiceAtivo] = useState(indiceInicial);
  const refLista = useRef<HTMLDivElement>(null);
  const buffer = useRef("");
  const timerBuffer = useRef<number | undefined>(undefined);

  const podeIr = useCallback((i: number) => i >= 0 && i < itens.length && !desabilitado?.(itens[i]), [desabilitado, itens]);

  /** Anda `passo` posições pulando desabilitados. */
  const mover = useCallback(
    (de: number, passo: number): number => {
      const n = itens.length;
      if (n === 0) return -1;
      let i = de;
      for (let tentativas = 0; tentativas < n; tentativas++) {
        i += passo;
        if (i < 0) {
          if (!circular) return de;
          i = n - 1;
        }
        if (i >= n) {
          if (!circular) return de;
          i = 0;
        }
        if (podeIr(i)) return i;
      }
      return de;
    },
    [circular, itens.length, podeIr],
  );

  /** Primeiro/último habilitado — Home e End não devem parar num desabilitado. */
  const extremo = useCallback(
    (direcao: "inicio" | "fim"): number => {
      const ordem = direcao === "inicio" ? itens.map((_, i) => i) : itens.map((_, i) => itens.length - 1 - i);
      return ordem.find(podeIr) ?? -1;
    },
    [itens, podeIr],
  );

  const saltarPorTexto = useCallback(
    (tecla: string) => {
      window.clearTimeout(timerBuffer.current);
      buffer.current += tecla.toLowerCase();
      timerBuffer.current = window.setTimeout(() => {
        buffer.current = "";
      }, JANELA_TYPEAHEAD_MS);

      const alvo = buffer.current;
      // A busca começa DEPOIS do item ativo e dá a volta: digitar "a" duas
      // vezes anda entre os itens que começam com "a", em vez de travar no
      // primeiro. É o comportamento que todo select nativo tem.
      const n = itens.length;
      for (let passo = 1; passo <= n; passo++) {
        const i = (Math.max(indiceAtivo, 0) + passo) % n;
        if (!podeIr(i)) continue;
        if (rotuloDe(itens[i]).toLowerCase().startsWith(alvo)) {
          setIndiceAtivo(i);
          return;
        }
      }
    },
    [indiceAtivo, itens, podeIr, rotuloDe],
  );

  const aoTeclar = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setIndiceAtivo((i) => mover(i, 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setIndiceAtivo((i) => mover(i, -1));
          break;
        case "Home":
          e.preventDefault();
          setIndiceAtivo(extremo("inicio"));
          break;
        case "End":
          e.preventDefault();
          setIndiceAtivo(extremo("fim"));
          break;
        case "Enter":
          if (indiceAtivo >= 0) {
            e.preventDefault();
            aoEscolher?.(itens[indiceAtivo], indiceAtivo);
          }
          break;
        case " ":
          // Espaço confirma em listbox, mas em Combobox ele é um caractere
          // legítimo da busca. Só confirma quando não há buffer de digitação.
          if (indiceAtivo >= 0 && buffer.current === "") {
            e.preventDefault();
            aoEscolher?.(itens[indiceAtivo], indiceAtivo);
          }
          break;
        case "Tab":
          aoCancelar?.();
          break;
        default:
          // Só caractere imprimível único — ignora F1, Control, etc.
          if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            saltarPorTexto(e.key);
          }
      }
    },
    [aoCancelar, aoEscolher, extremo, indiceAtivo, itens, mover, saltarPorTexto],
  );

  // Mantém o item ativo visível dentro da lista rolável. `block: "nearest"`
  // rola o mínimo necessário — `center` faria a lista pular a cada seta, o que
  // desorienta mais do que ajuda.
  useEffect(() => {
    if (indiceAtivo < 0 || !refLista.current) return;
    const el = refLista.current.querySelector<HTMLElement>(`#${CSS.escape(`${idBase}-item-${indiceAtivo}`)}`);
    el?.scrollIntoView({ block: "nearest" });
  }, [indiceAtivo, idBase]);

  useEffect(() => () => window.clearTimeout(timerBuffer.current), []);

  return {
    indiceAtivo,
    definirIndiceAtivo: setIndiceAtivo,
    aoTeclar,
    idAtivo: indiceAtivo >= 0 ? `${idBase}-item-${indiceAtivo}` : undefined,
    idDoItem: (i: number) => `${idBase}-item-${i}`,
    refLista,
  };
}
