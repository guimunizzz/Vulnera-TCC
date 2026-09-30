/**
 * dashboard-scene-palette.ts
 *
 * O QUE FAZ
 * Traduz os tokens semânticos do tema para as cores que o Three.js precisa
 * receber em formato hexadecimal.
 *
 * POR QUE EXISTE
 * Materiais WebGL não leem `oklch(var(--token))` de forma portável. Manter a
 * tradução em um único módulo evita hex espalhado pela cena e garante que a
 * troca dark/light seja explícita e testável.
 *
 * QUEM USA
 * `use-dashboard-scene.ts`, dentro do chunk lazy do hero do dashboard.
 */

import type { ThemeResolvido } from "../../../design/theme";

export interface DashboardScenePalette {
  accent: string;
  accentSoft: string;
  neutral: string;
}

/**
 * Equivalentes sRGB dos tokens semânticos usados no produto. Estes valores só
 * existem porque o renderer exige uma cor concreta; o DOM continua usando os
 * tokens CSS diretamente.
 */
export const DASHBOARD_SCENE_PALETTE: Record<ThemeResolvido, DashboardScenePalette> = {
  dark: {
    accent: "#a38bf9", // --color-accent-ink / iris-300 aproximado
    accentSoft: "#6f4fd3", // --color-accent / iris-600 aproximado
    neutral: "#8290a8", // --color-text-muted aproximado
  },
  light: {
    accent: "#5d35b8", // --color-accent-ink / iris-700 aproximado
    accentSoft: "#855fea", // --color-accent / iris-600 aproximado
    neutral: "#526078", // --color-text-muted aproximado
  },
};
