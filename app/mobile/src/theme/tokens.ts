/**
 * theme/tokens.ts
 *
 * Portação dos tokens de app/web/src/styles/tokens.css pro React Native.
 * O próprio tokens.css avisa (§0, "QUEM USA"): "Fase 7 (mobile), que porta
 * os mesmos valores" — é este arquivo.
 *
 * React Native não lê CSS/oklch() nativamente, então os valores em OKLCH do
 * web foram convertidos pra hex sRGB (matriz padrão de Björn Ottosson —
 * mesma fórmula usada pelo `oklch()` do navegador). Só o tema ESCURO foi
 * portado: é o único tema do produto hoje (`:root` sem `data-theme` já é
 * escuro por padrão em tokens.css) — o mobile não tem alternância de tema.
 *
 * Fontes customizadas (Archivo/JetBrains Mono) NÃO foram portadas — exigiriam
 * bundlar arquivo de fonte via expo-font, fora do escopo enxuto da Fase 7.
 * Usa a fonte padrão do sistema (San Francisco no iOS, Roboto no Android);
 * só o vetor CVSS usa uma fonte monoespaçada do sistema, pelo mesmo motivo
 * do web (0/O e 1/l/I inconfundíveis).
 */

export const COLORS = {
  // --- superfícies (dark, ver tokens.css §8) ---
  canvas: "#0c1015", // --color-bg-canvas (neutral-950)
  surface: "#151b21", // --color-bg-surface (neutral-900)
  raised: "#21272f", // --color-bg-raised (neutral-800)
  inset: "#06090e", // --color-bg-inset

  // --- texto ---
  textPrimary: "#f9fafb", // neutral-50
  textSecondary: "#d0d4da", // neutral-300
  textMuted: "#9ea4ab", // neutral-400

  // --- bordas ---
  borderSubtle: "#21272f", // neutral-800
  borderDefault: "#2f363f",
  borderStrong: "#767c85", // neutral-500

  // --- ação (iris) ---
  accent: "#7046cf", // iris-600 — preenchimento de botão
  accentHover: "#855fea", // iris-500
  accentFg: "#f9fafb", // texto sobre o acento
  accentInk: "#bdb0f9", // iris-300 — link / texto de ação
  accentSurface: "#1f0a45", // iris-950

  // --- estados ---
  success: "#209659", // green-500
  successInk: "#5fd891", // green-300
  successSurface: "#062111", // green-950
  danger: "#c11c1f", // red-600
  dangerInk: "#f9a197", // red-300
  dangerSurface: "#540b0b", // red-900

  // --- severidade (mesmo vocabulário do SeverityBadge web) ---
  severity: {
    critical: "#e13331", // red-500
    criticalInk: "#f9a197", // red-300
    criticalSurface: "#540b0b", // red-900
    high: "#eb8023", // orange-400
    highInk: "#f9a66c", // orange-300
    highSurface: "#432207", // orange-900
    medium: "#c79823", // amber-400
    mediumInk: "#e7b435", // amber-300
    mediumSurface: "#372907", // amber-900
    low: "#287bed", // blue-500
    lowInk: "#97bef9", // blue-300
    lowSurface: "#072959", // blue-900
    info: "#767c85", // neutral-500
    infoInk: "#d0d4da", // neutral-300
    infoSurface: "#21272f", // neutral-800
  },
} as const;

/** Escala de 4px — mesma de tokens.css §3 (sem meio-passo). */
export const SPACING = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
  24: 96,
} as const;

/** tokens.css §4 — raio nomeado por INTENÇÃO, não por tamanho. */
export const RADIUS = {
  control: 6, // botão, input, chip
  container: 10, // card, painel
  overlay: 14, // modal/dialog (não usado hoje, reservado)
  full: 9999, // avatar, pill
} as const;

/** tokens.css §2 — escala modular 1.200, convertida de rem (base 16px) pra px. */
export const FONT_SIZE = {
  xs: 12, // micro-rótulo caixa alta
  sm: 14, // corpo e lista — base da escala
  base: 17,
  lg: 20,
  xl: 24,
  "2xl": 29,
} as const;

export const FONT_WEIGHT = {
  regular: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
} as const;

/** Fonte monoespaçada do sistema — só pro vetor CVSS (0/O, 1/l/I inconfundíveis). */
export const MONO_FONT = "Courier New";

/** WCAG 2.5.5/2.5.8 — todo controle interativo alcança 44px, igual ao web (--size-touch-target). */
export const TOUCH_TARGET = 44;
