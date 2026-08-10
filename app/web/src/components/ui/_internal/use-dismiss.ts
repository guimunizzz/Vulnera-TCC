/**
 * use-dismiss.ts + use-scroll-lock.ts + use-inert-fora
 *
 * O QUE FAZ
 * As três peças de comportamento que todo overlay precisa e que o Radix
 * entregava embutidas:
 *   - `useDismiss`      — Escape fecha, clique fora fecha
 *   - `useScrollLock`   — trava a rolagem do body enquanto aberto
 *   - `useInertForaDe`  — esconde o resto da árvore de leitores de tela
 *
 * POR QUE JUNTOS NUM ARQUIVO
 * São sempre usados em conjunto e cada um tem 20 linhas. Separar em três
 * arquivos de 20 linhas com o mesmo cabeçalho seria burocracia.
 *
 * QUEM USA
 * `Dialog`, `Drawer`, `Popover`, `DropdownMenu`, `ContextMenu`, `Tooltip`.
 */

import { useEffect } from "react";

/* ==========================================================================
   Escape + clique fora
   ========================================================================== */

export interface OpcoesDismiss {
  ativo: boolean;
  aoFechar: () => void;
  /** Elemento do overlay. Clique DENTRO dele não fecha. */
  refConteudo: React.RefObject<HTMLElement>;
  /** Gatilho. Clique nele não fecha aqui — o próprio gatilho alterna. */
  refGatilho?: React.RefObject<HTMLElement>;
  /** Desliga o fechamento por clique fora (dialog de confirmação, por ex). */
  fecharAoClicarFora?: boolean;
}

export function useDismiss({ ativo, aoFechar, refConteudo, refGatilho, fecharAoClicarFora = true }: OpcoesDismiss) {
  useEffect(() => {
    if (!ativo) return;

    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // `stopPropagation` para que, com dois overlays empilhados (um popover
      // dentro de um dialog), o Escape feche só o de cima. Sem isso os dois
      // fecham juntos e a pessoa perde o contexto inteiro.
      e.stopPropagation();
      aoFechar();
    };

    // `pointerdown` e não `click`: fechar no click permitiria que o mousedown
    // fora seguido de mouseup dentro (arrastar uma seleção de texto para fora)
    // fosse lido como "clicou fora". Também é o que faz o overlay fechar antes
    // de o clique acertar o que está por baixo.
    const aoApontar = (e: PointerEvent) => {
      if (!fecharAoClicarFora) return;
      const alvo = e.target as Node;
      if (refConteudo.current?.contains(alvo)) return;
      if (refGatilho?.current?.contains(alvo)) return;
      aoFechar();
    };

    document.addEventListener("keydown", aoTeclar);
    // `true` (fase de captura): pega o evento antes de qualquer handler da
    // página, inclusive de um `stopPropagation` bem-intencionado lá embaixo.
    document.addEventListener("pointerdown", aoApontar, true);
    return () => {
      document.removeEventListener("keydown", aoTeclar);
      document.removeEventListener("pointerdown", aoApontar, true);
    };
  }, [ativo, aoFechar, refConteudo, refGatilho, fecharAoClicarFora]);
}

/* ==========================================================================
   Trava de rolagem
   ========================================================================== */

/** Quantos overlays estão pedindo a trava agora. Ver o porquê abaixo. */
let travasAtivas = 0;
let overflowOriginal = "";
let paddingOriginal = "";

/**
 * Impede a página de rolar por trás de um overlay.
 *
 * ⚠️ O contador existe porque overlays se empilham. Um popover aberto dentro de
 * um dialog: se cada um restaurasse o `overflow` ao fechar, fechar o popover
 * destravaria a rolagem com o dialog ainda aberto.
 *
 * ⚠️ A compensação de `padding-right` existe porque esconder a barra de
 * rolagem alarga a viewport, e a página inteira dá um salto lateral no momento
 * em que o dialog abre. Repor a largura da barra como padding cancela o salto.
 */
export function useScrollLock(ativo: boolean) {
  useEffect(() => {
    if (!ativo) return;

    if (travasAtivas === 0) {
      const larguraDaBarra = window.innerWidth - document.documentElement.clientWidth;
      overflowOriginal = document.body.style.overflow;
      paddingOriginal = document.body.style.paddingRight;
      document.body.style.overflow = "hidden";
      if (larguraDaBarra > 0) document.body.style.paddingRight = `${larguraDaBarra}px`;
    }
    travasAtivas += 1;

    return () => {
      travasAtivas -= 1;
      if (travasAtivas === 0) {
        document.body.style.overflow = overflowOriginal;
        document.body.style.paddingRight = paddingOriginal;
      }
    };
  }, [ativo]);
}

/* ==========================================================================
   `inert` no resto da árvore
   ========================================================================== */

/**
 * Marca tudo o que NÃO é o overlay como `inert` enquanto ele está aberto.
 *
 * POR QUE, SE JÁ EXISTE A ARMADILHA DE FOCO
 * A armadilha resolve o teclado. Ela não resolve o leitor de tela: no modo de
 * navegação por vozes (rotor do VoiceOver, setas do NVDA), a pessoa pode ler a
 * página inteira sem nunca mover o foco — e leria o formulário atrás do dialog
 * como se estivesse disponível. `inert` remove o ramo da árvore de
 * acessibilidade e do alcance do ponteiro de uma vez.
 *
 * Aplicado nos IRMÃOS do overlay, não no `body`: marcar o body inteiro
 * incluiria o próprio overlay.
 */
export function useInertForaDe(ativo: boolean, refOverlay: React.RefObject<HTMLElement>) {
  useEffect(() => {
    if (!ativo) return;
    const overlay = refOverlay.current;
    if (!overlay) return;

    // O overlay vive num portal, filho direto do body. Os irmãos dele são o
    // #root da aplicação e os portais de outros overlays.
    const raizDoOverlay = overlay.closest("body > *") ?? overlay;
    const alterados: HTMLElement[] = [];

    for (const irmao of Array.from(document.body.children)) {
      if (irmao === raizDoOverlay || !(irmao instanceof HTMLElement)) continue;
      if (irmao.hasAttribute("inert")) continue; // já inerte por um overlay de baixo
      irmao.setAttribute("inert", "");
      alterados.push(irmao);
    }

    return () => {
      for (const el of alterados) el.removeAttribute("inert");
    };
  }, [ativo, refOverlay]);
}
