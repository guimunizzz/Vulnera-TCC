/**
 * motion/tokens.ts
 *
 * O QUE FAZ
 * Espelha em TypeScript os tokens de movimento definidos em
 * `src/styles/tokens.css`, para que o `motion` (que anima em JS, não em CSS)
 * use exatamente os mesmos números que as transições CSS.
 *
 * POR QUE ESPELHAR EM VEZ DE LER O CSS
 * Ler `getComputedStyle(document.documentElement)` funcionaria no navegador,
 * mas quebraria em teste (jsdom não resolve custom properties em cascata) e
 * traria uma leitura de layout a cada animação. O espelho é mais simples — e o
 * risco de ele divergir do CSS é coberto por `motion/tokens.test.ts`, que lê o
 * tokens.css de verdade e compara valor a valor. Se alguém mudar um lado só, o
 * teste quebra.
 *
 * 🎯 REGRA: nenhum componente escreve `duration: 0.2`. Importa daqui.
 *
 * QUEM USA
 * Tudo em `src/motion/` e qualquer componente que anime com `motion`.
 */

/** Durações em SEGUNDOS — a unidade que o `motion` espera (o CSS usa ms). */
export const DURACAO = {
  instant: 0.08,
  fast: 0.14,
  base: 0.2,
  slow: 0.32,
  chart: 0.7,
} as const;

/**
 * Curvas de easing como array de 4 números — o formato do `motion` para
 * cubic-bezier. Os valores são os mesmos de `--ease-*` no tokens.css.
 */
export const EASE = {
  out: [0.16, 1, 0.3, 1],
  spring: [0.34, 1.56, 0.64, 1],
  emphasized: [0.2, 0, 0, 1],
} as const;

/**
 * Física de spring para movimento ESPACIAL (posição, escala, layout).
 *
 * Por que spring e não duração fixa: uma duração fixa faz todo deslocamento
 * levar o mesmo tempo, independentemente da distância — o que faz um movimento
 * de 4px parecer lento e um de 400px parecer teleporte. A spring resolve pela
 * física: distância maior, mais tempo, sem ninguém decidir.
 *
 * Opacidade e cor continuam em duração + easing: não têm "distância física",
 * e uma spring em opacidade produz o overshoot invisível de passar de 1.0.
 */
export const SPRING = {
  /** Padrão: assenta rápido, quase sem oscilar. */
  padrao: { type: "spring", stiffness: 320, damping: 30 },
  /** Mais solto — para o contador de KPI, onde um leve overshoot lê como "subiu". */
  suave: { type: "spring", stiffness: 220, damping: 26 },
  /** Mais firme — para layout compartilhado, onde oscilar embaralha a leitura. */
  firme: { type: "spring", stiffness: 400, damping: 34 },
} as const;

/**
 * Deslocamentos padrão, em px. Pequenos de propósito: o objetivo é dizer "isto
 * chegou agora", não fazer o elemento viajar pela tela.
 */
export const DESLOCAMENTO = {
  /** Entrada de item de lista. */
  lista: 10,
  /** Entrada de overlay ancorado (popover, dropdown). */
  ancorado: 6,
} as const;

/**
 * Atraso entre itens consecutivos de uma lista, em segundos.
 * 20–40ms é a janela em que o escalonamento é percebido como "a lista se
 * montou" em vez de "a lista está lenta". Acima disso, uma lista de 20 itens
 * levaria quase um segundo para terminar de aparecer.
 */
export const STAGGER = 0.03;

/**
 * Teto de itens que participam do escalonamento.
 *
 * Sem teto, uma tabela de 200 findings teria o último item entrando 6 segundos
 * depois do primeiro. Passando de 12, o resto entra junto — ninguém percebe a
 * diferença abaixo da dobra, e a página fica pronta.
 */
export const STAGGER_MAX_ITENS = 12;
