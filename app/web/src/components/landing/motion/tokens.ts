/**
 * components/landing/motion/tokens.ts
 *
 * O QUE FAZ
 * A escala de movimento da landing pública: durações, curvas, escalonamentos,
 * deslocamentos e suavização de scroll. Nenhuma seção escreve esses números.
 *
 * POR QUE UMA ESCALA PRÓPRIA
 * O app autenticado é "instrumento, não painel de marketing": nada passa de
 * 400 ms, exceto o desenho de gráfico (`src/motion/tokens.ts`). A landing é
 * apresentação de 30 segundos e pode ser mais expressiva — traço que se
 * desenha, número que conta, seção que entra. Por isso ela tem durações
 * maiores, mas igualmente nomeadas por INTENÇÃO, para que "quanto tempo isto
 * leva?" seja decidido uma vez, aqui.
 *
 * MOVIMENTO REDUZIDO
 * Segue a regra do DESIGN_SYSTEM §5: sai deslocamento e escala, fica a
 * opacidade, a duração encolhe. A duração reduzida é a mesma `fast` do app.
 *
 * QUEM USA
 * As seções da landing que animam com GSAP.
 */

import { DURACAO } from "../../../motion/tokens";

/** Durações em segundos (unidade do GSAP), da mais curta à mais longa. */
export const DURACAO_LANDING = {
  /** Fade sob movimento reduzido — o mesmo `fast` do app. */
  reduzida: DURACAO.fast,
  /** Marcador pequeno aparecendo (ponto do radar). */
  pontual: 0.4,
  /** Bloco entrando na tela (passo, card). */
  entrada: 0.6,
  /** Barra crescendo até o valor. */
  crescimento: 0.8,
  /** Área preenchendo depois do traço. */
  preenchimento: 1,
  /** Traço sendo desenhado (radar). */
  traco: 1.4,
  /** Número contando até o valor final. */
  contagem: 1.6,
} as const;

/** Curvas no formato do GSAP. */
export const EASE_LANDING = {
  /** Desacelera ao chegar — padrão das entradas. */
  saida: "power2.out",
  /** Desaceleração mais longa, para contagem. */
  enfase: "power3.out",
  /** Passa um pouco do alvo e volta — só para marcadores pequenos. */
  ressalto: "back.out(2)",
  /** Proporcional ao scroll: efeitos com scrub. */
  linear: "none",
} as const;

/** Atraso entre itens consecutivos, em segundos. */
export const ESCALONAMENTO_LANDING = {
  /** Passos do "Como funciona", lidos um a um. */
  passos: 0.2,
  /** Itens de lista densos (domínios, pontos do radar). */
  itens: 0.08,
} as const;

/** Atrasos dentro de uma timeline, em segundos a partir do início dela. */
export const ATRASO_LANDING = {
  /** Pontos do radar entram depois que o traço começou. */
  pontos: 0.3,
  /** Preenchimento começa depois dos pontos. */
  preenchimento: 0.4,
} as const;

/** Deslocamentos e escalas iniciais. */
export const DESLOCAMENTO_LANDING = {
  /** Distância vertical de uma entrada, em px. */
  entrada: 24,
  /** Escala inicial do título da chamada final, que cresce com o scroll. */
  escalaChamadaFinal: 0.92,
} as const;

/**
 * Suavização do scrub, em segundos de "atraso" atrás da barra de rolagem.
 * `true` (sem suavização) é usado sob movimento reduzido quando o efeito é
 * informativo, como a barra de progresso.
 */
export const SCRUB_LANDING = {
  /** Barra de progresso: quase colada ao scroll. */
  barra: 0.3,
  /** Desenho de linha acompanhando a seção. */
  linha: 0.5,
} as const;

/** Breakpoint `md` do Tailwind — abaixo dele, efeitos decorativos de layout largo somem. */
export const LARGURA_DESKTOP_LANDING = 768;
