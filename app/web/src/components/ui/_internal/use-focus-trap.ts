/**
 * use-focus-trap.ts
 *
 * O QUE FAZ
 * Prende o foco dentro de um elemento enquanto ele estiver aberto, e devolve o
 * foco ao gatilho quando fechar.
 *
 * POR QUE EXISTE
 * Era o que o `@radix-ui/react-dialog` entregava de graça e que a Fase 6.5
 * assumiu reconstruir (ADR-023). Sem armadilha de foco, o Tab a partir do
 * último botão de um dialog leva para a barra de endereços e depois para a
 * página ATRÁS do dialog — que continua lá, invisível para quem enxerga e
 * perfeitamente navegável para quem usa teclado ou leitor de tela.
 *
 * COMO FUNCIONA
 * 1. Guarda quem tinha o foco antes de abrir.
 * 2. Move o foco para dentro (o primeiro focável, ou o elemento marcado com
 *    `data-autofocus`).
 * 3. Intercepta Tab/Shift+Tab: no último elemento, Tab volta ao primeiro; no
 *    primeiro, Shift+Tab vai ao último.
 * 4. Ao fechar, devolve o foco a quem o tinha.
 *
 * ⚠️ A lista de focáveis é recalculada a CADA Tab, não uma vez na abertura. Um
 * dialog cujo conteúdo muda (um passo de wizard, um campo que aparece após
 * marcar uma caixa) teria uma lista velha e prenderia o foco no lugar errado.
 *
 * QUEM USA
 * `Dialog`, `Drawer`, e qualquer overlay modal criado depois.
 */

import { useEffect, useRef } from "react";

/**
 * Seletor do que o navegador considera focável por Tab.
 * `:not([disabled])` e `[tabindex]:not([tabindex="-1"])` importam: um botão
 * desabilitado ou um item de menu com tabindex -1 (roving) não recebe Tab.
 */
const FOCAVEIS = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
  "audio[controls]",
  "video[controls]",
  "[contenteditable]:not([contenteditable='false'])",
].join(",");

/**
 * O elemento está visível o bastante para receber foco?
 *
 * ⚠️ NÃO use `offsetParent === null` para isto. É o atalho comum e está errado
 * em dois casos que importam aqui:
 *   1. `offsetParent` é `null` para QUALQUER elemento `position: fixed` — e
 *      overlay é justamente onde tudo é fixed. Um botão fixed dentro do painel
 *      seria excluído da armadilha e o Tab escaparia por ele.
 *   2. `offsetParent` é sempre `null` no jsdom, o que tornaria a armadilha
 *      intestável — e uma armadilha de foco que não se testa não se mantém.
 *
 * A checagem correta é a cadeia de estilo computado, que é o que o navegador
 * de fato usa para decidir se algo é focável.
 */
function estaVisivel(el: HTMLElement): boolean {
  if (el.hasAttribute("hidden") || el.getAttribute("aria-hidden") === "true") return false;
  if (el.closest("[inert]")) return false;

  for (let atual: HTMLElement | null = el; atual; atual = atual.parentElement) {
    const estilo = getComputedStyle(atual);
    if (estilo.display === "none" || estilo.visibility === "hidden" || estilo.visibility === "collapse") return false;
  }
  return true;
}

function focaveisDe(raiz: HTMLElement): HTMLElement[] {
  return Array.from(raiz.querySelectorAll<HTMLElement>(FOCAVEIS)).filter(estaVisivel);
}

export interface OpcoesFocusTrap {
  /** A armadilha só age quando `true`. */
  ativo: boolean;
  /** Devolver o foco ao fechar? Padrão `true`. */
  devolverFoco?: boolean;
}

export function useFocusTrap<T extends HTMLElement>(ref: React.RefObject<T>, { ativo, devolverFoco = true }: OpcoesFocusTrap) {
  const focoAnterior = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!ativo) return;
    const container = ref.current;
    if (!container) return;

    focoAnterior.current = document.activeElement as HTMLElement | null;

    // Foco inicial: quem se declarou `data-autofocus` tem prioridade — em um
    // dialog de confirmação destrutiva, queremos o foco em "Cancelar", não no
    // botão que apaga.
    const alvo =
      container.querySelector<HTMLElement>("[data-autofocus]") ?? focaveisDe(container)[0] ?? container;
    // `preventScroll` evita que o navegador role a página até o elemento — o
    // overlay já está na viewport, e o scroll roubaria a posição de leitura.
    alvo.focus({ preventScroll: true });

    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const lista = focaveisDe(container);
      if (lista.length === 0) {
        // Nada focável dentro: o foco fica no próprio container, e o Tab não
        // deve escapar mesmo assim.
        e.preventDefault();
        return;
      }
      const primeiro = lista[0];
      const ultimo = lista[lista.length - 1];
      const atual = document.activeElement;

      if (e.shiftKey && (atual === primeiro || atual === container)) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && atual === ultimo) {
        e.preventDefault();
        primeiro.focus();
      } else if (atual instanceof Node && !container.contains(atual)) {
        // O foco escapou por outro caminho (clique fora, foco programático).
        // Traz de volta.
        e.preventDefault();
        primeiro.focus();
      }
    };

    document.addEventListener("keydown", aoTeclar, true);
    return () => {
      document.removeEventListener("keydown", aoTeclar, true);
      if (devolverFoco) {
        const anterior = focoAnterior.current;
        // `isConnected` protege o caso em que o gatilho saiu do DOM enquanto o
        // overlay estava aberto (uma linha de tabela removida, por exemplo).
        if (anterior?.isConnected) anterior.focus({ preventScroll: true });
      }
    };
  }, [ativo, devolverFoco, ref]);
}
