/**
 * components/landing/motion/use-landing-motion.ts
 *
 * O QUE FAZ
 * - `useMovimentoLanding`: roda uma animação GSAP com as condições da landing
 *   (movimento reduzido ou não, desktop), refaz quando uma delas muda e desfaz
 *   tudo no unmount.
 * - `useRecalculoDoScroll`: chama `ScrollTrigger.refresh()` depois que as
 *   fontes carregam e quando a altura da página muda.
 *
 * POR QUE EXISTE
 * Cada seção consultava `window.matchMedia` à mão e só no momento da montagem.
 * Aqui as condições são reativas — movimento reduzido vem do sistema OU do
 * menu de acessibilidade (`design/accessibility.ts`) e a largura de uma media
 * query: quando a pessoa liga "reduzir movimento" (ou a largura cruza o
 * breakpoint), o contexto do `useGSAP` é
 * revertido e a animação roda de novo na versão certa. O revert também mata
 * os ScrollTriggers da seção no unmount: sair da landing e voltar não deixa
 * triggers órfãos.
 *
 * POR QUE NÃO `gsap.matchMedia()`
 * Era a primeira opção, e foi medida: na troca de condição o GSAP refaz tudo
 * por `matchMediaInit → revertAll → refreshAll`, caminho em que o ScrollTrigger
 * zera a rolagem para medir e não a restaura. Com a página no rodapé, ligar
 * "reduzir movimento" a levava ao topo (a navbar ainda animava a altura com o
 * scroll em 0 e o Motion "restaurava" esse 0). Com as condições no React, a
 * reexecução passa por um `ScrollTrigger.refresh()` comum, que grava e
 * restaura a posição.
 *
 * O recálculo existe porque o ScrollTrigger mede posições uma vez. Fonte web
 * que chega depois, FAQ que abre e imagem que carrega mudam a altura da página
 * e deixariam gatilhos e a barra de progresso desalinhados.
 *
 * QUEM USA
 * As seções da landing (`how-it-works`, `maturity`, `final-cta`, `ui.tsx`) e a
 * raiz das seções (`landing-root.tsx`).
 */

import { useEffect, useRef, useSyncExternalStore, type RefObject } from "react";
import { ScrollTrigger, useGSAP } from "./gsap";
import { LARGURA_DESKTOP_LANDING } from "./tokens";
import { useMovimentoReduzido } from "../../../design/accessibility";

export const CONDICOES_LANDING = {
  desktop: `(min-width: ${LARGURA_DESKTOP_LANDING}px)`,
} as const;

/** `reduzido` vem do sistema OU do menu de acessibilidade; `normal` é o oposto. */
export interface CondicoesLanding {
  reduzido: boolean;
  normal: boolean;
  desktop: boolean;
}

/** Media query reativa: re-renderiza quando a condição muda. */
function useConsulta(consulta: string): boolean {
  return useSyncExternalStore(
    (avisar) => {
      const media = window.matchMedia(consulta);
      media.addEventListener("change", avisar);
      return () => media.removeEventListener("change", avisar);
    },
    () => window.matchMedia(consulta).matches,
    () => false,
  );
}

let quadroDoRecalculo = 0;

/**
 * Um único `ScrollTrigger.refresh()` por quadro, não importa quantas seções
 * peçam: refresh mede a página inteira e não precisa rodar quatro vezes.
 */
function agendarRecalculo(): void {
  if (quadroDoRecalculo) return;
  quadroDoRecalculo = requestAnimationFrame(() => {
    quadroDoRecalculo = 0;
    ScrollTrigger.refresh();
  });
}

export function useMovimentoLanding(
  escopo: RefObject<Element | null>,
  animar: (condicoes: CondicoesLanding) => void | (() => void),
): void {
  // Sistema OU menu de acessibilidade (design/accessibility.ts) — a media
  // query sozinha não enxerga a opção do menu.
  const reduzido = useMovimentoReduzido();
  const desktop = useConsulta(CONDICOES_LANDING.desktop);
  const primeiraVez = useRef(true);

  useGSAP(
    () => {
      const limpar = animar({ reduzido, normal: !reduzido, desktop });
      // Reexecução por troca de condição: os ScrollTriggers novos só
      // acertariam o progresso na próxima rolagem.
      if (!primeiraVez.current) agendarRecalculo();
      primeiraVez.current = false;
      return limpar;
    },
    // `revertOnUpdate`: ao mudar uma condição, desfaz a versão anterior
    // (tweens, ScrollTriggers e estilos) antes de rodar a nova.
    { scope: escopo, dependencies: [reduzido, desktop], revertOnUpdate: true },
  );
}

export function useRecalculoDoScroll(raiz: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const elemento = raiz.current;
    if (!elemento) return;
    let ativo = true;
    // Várias mudanças no mesmo quadro (seções revelando juntas) viram um
    // único refresh.
    const recalcular = () => {
      if (ativo) agendarRecalculo();
    };

    document.fonts?.ready.then(recalcular).catch(() => undefined);

    let alturaAnterior = elemento.offsetHeight;
    const observador = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(() => {
      const altura = elemento.offsetHeight;
      if (altura === alturaAnterior) return;
      alturaAnterior = altura;
      recalcular();
    });
    observador?.observe(elemento);

    return () => {
      ativo = false;
      observador?.disconnect();
    };
  }, [raiz]);
}

/**
 * Marca com `data-fora-da-tela` as seções (e o rodapé) fora da viewport; o CSS
 * da landing pausa os loops decorativos dentro delas (pulso, piscar, seta).
 * Um observador para a página inteira, não um por seção.
 */
export function usePausarLoopsForaDaTela(raiz: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const elemento = raiz.current;
    if (!elemento || typeof IntersectionObserver === "undefined") return;
    const alvos = Array.from(elemento.querySelectorAll<HTMLElement>("section, footer"));
    const observador = new IntersectionObserver((entradas) => {
      for (const entrada of entradas) {
        entrada.target.toggleAttribute("data-fora-da-tela", !entrada.isIntersecting);
      }
    });
    alvos.forEach((alvo) => observador.observe(alvo));
    return () => {
      observador.disconnect();
      alvos.forEach((alvo) => alvo.removeAttribute("data-fora-da-tela"));
    };
  }, [raiz]);
}
