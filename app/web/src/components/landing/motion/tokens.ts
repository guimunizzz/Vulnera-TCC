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
  /** Progresso da cena narrativa: segue o scroll com um pouco de inércia. */
  cena: 0.6,
} as const;

/* --------------------------------------------------------------------------
   Micro-interações em Motion (entrada ao aparecer, hover, toque, acordeão).
   Motion recebe segundos e curvas no formato dele, não strings do GSAP.
   -------------------------------------------------------------------------- */

/** Curvas no formato do Motion. */
export const EASE_MOTION_LANDING = {
  /** Entradas: desacelera ao chegar. */
  saida: "easeOut",
  /** Abre e fecha (acordeão): simétrica. */
  alternancia: "easeInOut",
} as const;

/** Durações em Motion que não existem no app. */
export const DURACAO_MOTION_LANDING = {
  /** Bloco aparecendo ao entrar na tela (`Reveal`, hero). */
  entrada: DURACAO_LANDING.entrada,
  /** Acordeão do FAQ abrindo ou fechando. */
  alternancia: 0.25,
} as const;

/** Escalas de resposta ao ponteiro e de entrada de overlay. */
export const ESCALA_LANDING = {
  hover: 1.04,
  toque: 0.97,
  /** Cartão do modal antes de entrar. */
  overlay: 0.98,
} as const;

/** Deslocamentos de micro-interação, em px. */
export const DESLOCAMENTO_MOTION_LANDING = {
  /** Bloco revelado ao entrar na tela. */
  revelacao: 20,
  /** Card do modal entrando. */
  overlay: 16,
  /** Cartão de plano subindo no hover. */
  elevacao: 6,
  /** Dropdown da navbar. */
  menu: 6,
} as const;

/** Escalonamento em Motion, em segundos. */
export const ESCALONAMENTO_MOTION_LANDING = {
  /** Entre blocos revelados em sequência (cards, itens de lista). */
  revelacao: 0.15,
  /** Itens do hero, depois de um respiro inicial. */
  hero: 0.15,
  /** Respiro antes do primeiro item do hero. */
  inicioHero: 0.2,
} as const;

/** Mola do cartão de plano (hover): firme, com um leve assentamento. */
export const MOLA_LANDING = {
  cartao: { type: "spring", stiffness: 300, damping: 22 },
} as const;

/** Breakpoint `md` do Tailwind — abaixo dele, efeitos decorativos de layout largo somem. */
export const LARGURA_DESKTOP_LANDING = 768;
