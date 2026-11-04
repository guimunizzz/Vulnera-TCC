/**
 * palette.ts
 *
 * Cores concretas da cena do grafo por tema. Materiais WebGL não leem
 * `oklch(var(--token))`, então os valores abaixo espelham os tokens de
 * `styles/tokens.css` (comentário ao lado de cada um). O DOM continua usando
 * os tokens CSS diretamente.
 *
 * `accent`, `accentSoft` e `neutral` vinham de `dashboard-scene-palette.ts`,
 * removido no refactor web-motion-3d (a atmosfera passou a ler os tokens em
 * runtime via `src/three/palette.ts`). Os valores foram trazidos para cá sem
 * mudança, para o grafo ficar idêntico; migrar esta paleta para a leitura de
 * tokens é pendência registrada no BACKLOG.
 */

import type { ThemeResolvido } from "../../../design/theme";
import type { DastRisk } from "../../../types/dast.types";

export interface GraphPalette {
  fundo: string;
  grade: string;
  /** Corpo metálico do servidor e das portas. */
  metal: string;
  /** Núcleo do globo da Internet. */
  nucleo: string;
  accent: string;
  accentSoft: string;
  neutral: string;
  severidade: Record<DastRisk, string>;
  sombra: number;
  bloom: { strength: number; radius: number; threshold: number };
}

export const GRAPH_PALETTE: Record<ThemeResolvido, GraphPalette> = {
  dark: {
    accent: "#a38bf9", // --color-accent-ink / iris-300 aproximado
    accentSoft: "#6f4fd3", // --color-accent / iris-600 aproximado
    neutral: "#8290a8", // --color-text-muted aproximado
    fundo: "#0d1018", // --color-bg-surface escuro aproximado
    grade: "#2a3142",
    metal: "#3a4152",
    nucleo: "#121a33",
    severidade: {
      HIGH: "#eb8023", // --orange-400
      MEDIUM: "#c79823", // --amber-400
      LOW: "#287bed", // --blue-500
      INFO: "#737c8b", // --neutral-500
    },
    sombra: 0.45,
    // Acima de 1.0 só brilha o que é HDR de propósito (meridianos, LEDs, partículas).
    bloom: { strength: 0.7, radius: 0.5, threshold: 1.0 },
  },
  light: {
    accent: "#5d35b8", // --color-accent-ink / iris-700 aproximado
    accentSoft: "#855fea", // --color-accent / iris-600 aproximado
    neutral: "#526078", // --color-text-muted aproximado
    fundo: "#f4f5f9", // --color-bg-surface claro aproximado
    grade: "#c9cedb",
    metal: "#8a93a8",
    nucleo: "#d9ddf0",
    severidade: {
      HIGH: "#9c5313", // --orange-600
      MEDIUM: "#836414", // --amber-600
      LOW: "#1464cd", // --blue-600
      INFO: "#737c8b", // --neutral-500
    },
    sombra: 0.18,
    // Fundo claro estoura com bloom forte: só os emissivos mais intensos brilham.
    bloom: { strength: 0.35, radius: 0.4, threshold: 0.95 },
  },
};
