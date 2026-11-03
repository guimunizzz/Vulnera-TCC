/**
 * palette.ts
 *
 * Cores concretas da cena do grafo por tema. Materiais WebGL não leem
 * `oklch(var(--token))`, então os valores abaixo espelham os tokens de
 * `styles/tokens.css` (comentário ao lado de cada um). O DOM continua usando
 * os tokens CSS diretamente.
 */

import type { ThemeResolvido } from "../../../design/theme";
import type { DastRisk } from "../../../types/dast.types";
import { DASHBOARD_SCENE_PALETTE } from "../../../components/dashboard/hero/dashboard-scene-palette";

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
    ...DASHBOARD_SCENE_PALETTE.dark,
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
    ...DASHBOARD_SCENE_PALETTE.light,
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
