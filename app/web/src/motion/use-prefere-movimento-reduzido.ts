/**
 * motion/use-prefere-movimento-reduzido.ts
 *
 * O QUE FAZ
 * Diz se o sistema pede movimento reduzido e RE-RENDERIZA quando a pessoa muda
 * essa preferência com a aplicação aberta.
 *
 * POR QUE EXISTE
 * O `useReducedMotion` do `motion` lê a media query uma única vez (é um
 * `useState` inicial; o próprio código dele traz um TODO sobre isso), apesar
 * de a documentação dizer que reage a mudanças. Quem ativava "reduzir
 * movimento" no sistema com o Vulnera aberto só via efeito depois de
 * recarregar a página. `useSyncExternalStore` assina a media query e mantém o
 * valor sempre atual.
 *
 * As animações internas do `motion` (`MotionConfig reducedMotion="user"`) já
 * acompanham a preferência; o que faltava era o lado do nosso código.
 *
 * QUEM USA
 * `useMotion()` e os poucos componentes que precisam só do booleano.
 */

import { useSyncExternalStore } from "react";

const CONSULTA = "(prefers-reduced-motion: reduce)";

function assinar(avisar: () => void): () => void {
  const media = window.matchMedia(CONSULTA);
  media.addEventListener("change", avisar);
  return () => media.removeEventListener("change", avisar);
}

function ler(): boolean {
  return window.matchMedia(CONSULTA).matches;
}

// No servidor não há preferência a ler; o padrão do navegador é "não reduzido".
const lerNoServidor = () => false;

export function usePrefereMovimentoReduzido(): boolean {
  return useSyncExternalStore(assinar, ler, lerNoServidor);
}
