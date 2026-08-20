/**
 * motion/use-motion.ts
 *
 * O QUE FAZ
 * O hook central de movimento. Devolve `reduzido` (a pessoa pediu menos
 * animação?) e os conjuntos de variantes já ajustados a essa preferência.
 *
 * POR QUE CENTRAL E NÃO CASO A CASO
 * `prefers-reduced-motion` tratado componente a componente vira uma checklist
 * que alguém esquece no décimo componente — e o esquecimento é invisível para
 * quem não usa a configuração. Aqui a decisão é tomada UMA vez: quem consome
 * `variantesOverlay()` recebe a versão certa sem saber que existe uma versão
 * errada.
 *
 * O QUE "MOVIMENTO REDUZIDO" SIGNIFICA AQUI
 * NÃO é "sem animação". É: sai o deslocamento, sai a escala, fica a opacidade,
 * e a duração encolhe. A pessoa continua vendo QUE algo mudou — só não vê a
 * coisa se mover, que é o que dispara desconforto vestibular.
 *
 * QUEM USA
 * Todo overlay (`Dialog`, `Drawer`, `Popover`, `DropdownMenu`, `Toast`), as
 * listas com escalonamento, o contador de KPI e a transição de rota.
 */

import { useReducedMotion } from "motion/react";
import type { Transition, Variants } from "motion/react";
import { DESLOCAMENTO, DURACAO, EASE, SPRING, STAGGER, STAGGER_MAX_ITENS } from "./tokens";

export interface Movimento {
  /** `true` quando o sistema pede movimento reduzido. */
  reduzido: boolean;
  /** Overlay centralizado: dialog. */
  overlay: Variants;
  /** Overlay ancorado a um gatilho: popover, dropdown, tooltip. */
  ancorado: Variants;
  /** Véu por trás de um overlay. */
  scrim: Variants;
  /** Container de lista escalonada — use com `item`. */
  lista: Variants;
  /** Item de lista escalonada. */
  item: Variants;
  /** Troca de conteúdo no mesmo lugar (skeleton → dados, aba → aba). */
  troca: Variants;
  /** Transição para o `layoutId` (card → detalhe). */
  layout: Transition;
  /** Spring para valores numéricos animados. */
  numero: Transition;
  /** Duração de desenho de gráfico, em ms (o Recharts pede ms). */
  duracaoGraficoMs: number;
}

export function useMotion(): Movimento {
  // `useReducedMotion` do motion já observa a media query e re-renderiza.
  // Devolve `null` antes de resolver — tratamos null como "não reduzido",
  // que é o comportamento padrão do navegador.
  const reduzido = useReducedMotion() ?? false;

  const saida: Transition = { duration: reduzido ? DURACAO.instant : DURACAO.fast, ease: EASE.out };
  const entrada: Transition = reduzido
    ? { duration: DURACAO.fast, ease: EASE.out }
    : { duration: DURACAO.base, ease: EASE.emphasized };

  return {
    reduzido,

    // Entrada em 0.96 → 1: a escala vem de baixo, como se a peça se
    // aproximasse. Saída mais rápida que a entrada (fast × base) porque, na
    // saída, a pessoa já decidiu — esperar a animação é atrito puro.
    overlay: {
      inicial: { opacity: 0, scale: reduzido ? 1 : 0.96 },
      visivel: { opacity: 1, scale: 1, transition: entrada },
      saindo: { opacity: 0, scale: reduzido ? 1 : 0.98, transition: saida },
    },

    // Ancorado desliza alguns pixels a partir do gatilho: o deslocamento
    // responde "de onde isto veio?".
    ancorado: {
      inicial: { opacity: 0, y: reduzido ? 0 : -DESLOCAMENTO.ancorado, scale: reduzido ? 1 : 0.98 },
      visivel: { opacity: 1, y: 0, scale: 1, transition: entrada },
      saindo: { opacity: 0, y: 0, scale: 1, transition: saida },
    },

    scrim: {
      inicial: { opacity: 0 },
      visivel: { opacity: 1, transition: entrada },
      saindo: { opacity: 0, transition: saida },
    },

    lista: {
      inicial: {},
      visivel: {
        transition: {
          staggerChildren: reduzido ? 0 : STAGGER,
          // Corta o escalonamento depois de N itens — ver STAGGER_MAX_ITENS.
          delayChildren: 0,
        },
      },
    },

    item: {
      inicial: { opacity: 0, y: reduzido ? 0 : DESLOCAMENTO.lista },
      visivel: { opacity: 1, y: 0, transition: reduzido ? { duration: DURACAO.fast } : SPRING.padrao },
    },

    troca: {
      inicial: { opacity: 0 },
      visivel: { opacity: 1, transition: entrada },
      saindo: { opacity: 0, transition: saida },
    },

    layout: reduzido ? { duration: DURACAO.instant } : SPRING.firme,
    numero: reduzido ? { duration: DURACAO.instant } : SPRING.suave,
    duracaoGraficoMs: reduzido ? 0 : DURACAO.chart * 1000,
  };
}

/**
 * Atraso de um item da lista, respeitando o teto.
 * Exposto porque nem toda lista usa `staggerChildren` — tabelas virtualizadas e
 * grids que remontam preferem calcular o delay por índice.
 */
export function atrasoDoItem(indice: number, reduzido: boolean): number {
  if (reduzido) return 0;
  return Math.min(indice, STAGGER_MAX_ITENS) * STAGGER;
}
