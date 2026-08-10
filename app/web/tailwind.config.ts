import type { Config } from "tailwindcss";

/**
 * tailwind.config.ts — a ponte entre os tokens e as classes utilitárias.
 *
 * O QUE FAZ
 * Traduz os tokens semânticos de `src/styles/tokens.css` em classes do
 * Tailwind. Nenhum valor de design nasce aqui — este arquivo só aponta.
 *
 * POR QUE EXISTE ASSIM
 * 1. `theme` (e não `theme.extend`) nas escalas de cor, espaçamento, raio,
 *    sombra e tipografia. Isso APAGA os defaults do Tailwind de propósito:
 *    `bg-zinc-800`, `rounded-md`, `text-sm` do Tailwind e `p-2.5` deixam de
 *    existir. Um design system que convive com a escala default do framework
 *    não é um design system — é uma sugestão.
 * 2. Só SEMÂNTICOS são expostos. `bg-iris-500` não compila. É a regra P1 dos
 *    tokens transformada em erro de build em vez de em recomendação.
 *    (A única tela autorizada a mostrar primitivo é `/styleguide`, e ela faz
 *    isso por `style={{ background: "oklch(var(--iris-500))" }}` — explícito.)
 * 3. `oklch(var(--x) / <alpha-value>)`: é o que faz `bg-accent/50` funcionar
 *    com tokens que guardam só "L C H". Ver o cabeçalho de tokens.css.
 *
 * QUEM USA
 * Todo componente de `src/components/ui/`, todas as páginas.
 */

/** Cor semântica com suporte a modificador de opacidade do Tailwind. */
const cor = (token: string) => `oklch(var(${token}) / <alpha-value>)`;

/** Token que já embute alpha — usado cru, sem modificador (ver tokens.css §8). */
const corComAlpha = (token: string) => `var(${token})`;

const cores = {
  transparent: "transparent",
  current: "currentColor",
  inherit: "inherit",

  // --- superfícies ---------------------------------------------------------
  canvas: cor("--color-bg-canvas"),
  surface: cor("--color-bg-surface"),
  raised: cor("--color-bg-raised"),
  overlay: cor("--color-bg-overlay"),
  inset: cor("--color-bg-inset"),

  // --- texto ---------------------------------------------------------------
  fg: {
    DEFAULT: cor("--color-text-primary"),
    secondary: cor("--color-text-secondary"),
    muted: cor("--color-text-muted"),
    inverted: cor("--color-text-inverted"),
  },

  // --- ação ----------------------------------------------------------------
  // `accent`      = preenchimento (botão, barra) — mínimo 3:1
  // `accent-ink`  = a MESMA cor calibrada para TEXTO — mínimo 4.5:1
  // `accent-fg`   = o que se escreve EM CIMA do preenchimento
  accent: {
    DEFAULT: cor("--color-accent"),
    hover: cor("--color-accent-hover"),
    active: cor("--color-accent-active"),
    fg: cor("--color-accent-fg"),
    ink: cor("--color-accent-ink"),
    surface: cor("--color-accent-surface"),
  },
  focus: cor("--color-focus-ring"),

  // --- estados -------------------------------------------------------------
  success: {
    DEFAULT: cor("--color-success"),
    ink: cor("--color-success-ink"),
    surface: cor("--color-success-surface"),
  },
  warning: {
    DEFAULT: cor("--color-warning"),
    ink: cor("--color-warning-ink"),
    surface: cor("--color-warning-surface"),
  },
  danger: {
    DEFAULT: cor("--color-danger"),
    hover: cor("--color-danger-hover"),
    fg: cor("--color-danger-fg"),
    ink: cor("--color-danger-ink"),
    surface: cor("--color-danger-surface"),
  },

  // --- severidade ----------------------------------------------------------
  severity: {
    critical: {
      DEFAULT: cor("--color-severity-critical"),
      ink: cor("--color-severity-critical-ink"),
      surface: cor("--color-severity-critical-surface"),
    },
    high: {
      DEFAULT: cor("--color-severity-high"),
      ink: cor("--color-severity-high-ink"),
      surface: cor("--color-severity-high-surface"),
    },
    medium: {
      DEFAULT: cor("--color-severity-medium"),
      ink: cor("--color-severity-medium-ink"),
      surface: cor("--color-severity-medium-surface"),
    },
    low: {
      DEFAULT: cor("--color-severity-low"),
      ink: cor("--color-severity-low-ink"),
      surface: cor("--color-severity-low-surface"),
    },
    info: {
      DEFAULT: cor("--color-severity-info"),
      ink: cor("--color-severity-info-ink"),
      surface: cor("--color-severity-info-surface"),
    },
  },

  // --- gráficos ------------------------------------------------------------
  chart: {
    1: cor("--color-chart-1"),
    2: cor("--color-chart-2"),
    3: cor("--color-chart-3"),
    4: cor("--color-chart-4"),
    5: cor("--color-chart-5"),
    6: cor("--color-chart-6"),
    grid: cor("--color-chart-grid"),
    axis: cor("--color-chart-axis"),
  },

  // --- tokens com alpha embutido (sem modificador `/N`) --------------------
  scrim: corComAlpha("--color-scrim"),
  hovered: corComAlpha("--color-bg-hover"),
  pressed: corComAlpha("--color-bg-active"),
};

/** Escala de 4px, sem meio-passo. Ver tokens.css §3. */
const espacamento = {
  0: "var(--space-0)",
  1: "var(--space-1)",
  2: "var(--space-2)",
  3: "var(--space-3)",
  4: "var(--space-4)",
  5: "var(--space-5)",
  6: "var(--space-6)",
  8: "var(--space-8)",
  10: "var(--space-10)",
  12: "var(--space-12)",
  16: "var(--space-16)",
  20: "var(--space-20)",
  24: "var(--space-24)",
  px: "1px", // hairline: borda e separador de 1px não são espaçamento
  touch: "var(--size-touch-target)",
};

export default {
  darkMode: ["class", '[data-theme="dark"]'],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    colors: cores,
    spacing: espacamento,

    // Tipografia: [tamanho, { lineHeight, letterSpacing }] — o par vem junto
    // de propósito. Escolher o tamanho sem escolher a entrelinha é o começo do
    // "text-3xl leading-tight" espalhado por 40 arquivos.
    fontSize: {
      xs: ["var(--text-xs)", { lineHeight: "var(--leading-xs)", letterSpacing: "var(--tracking-wide)" }],
      sm: ["var(--text-sm)", { lineHeight: "var(--leading-sm)", letterSpacing: "var(--tracking-normal)" }],
      base: ["var(--text-base)", { lineHeight: "var(--leading-base)", letterSpacing: "var(--tracking-normal)" }],
      lg: ["var(--text-lg)", { lineHeight: "var(--leading-lg)", letterSpacing: "var(--tracking-snug)" }],
      xl: ["var(--text-xl)", { lineHeight: "var(--leading-xl)", letterSpacing: "var(--tracking-snug)" }],
      "2xl": ["var(--text-2xl)", { lineHeight: "var(--leading-2xl)", letterSpacing: "var(--tracking-tight)" }],
      "3xl": ["var(--text-3xl)", { lineHeight: "var(--leading-3xl)", letterSpacing: "var(--tracking-tight)" }],
      "4xl": ["var(--text-4xl)", { lineHeight: "var(--leading-4xl)", letterSpacing: "var(--tracking-tight)" }],
    },
    fontFamily: {
      sans: "var(--font-sans)",
      mono: "var(--font-mono)",
    },
    fontWeight: {
      regular: "var(--weight-regular)",
      medium: "var(--weight-medium)",
      semibold: "var(--weight-semibold)",
      bold: "var(--weight-bold)",
    },

    borderRadius: {
      none: "0",
      control: "var(--radius-control)",
      container: "var(--radius-container)",
      overlay: "var(--radius-overlay)",
      full: "var(--radius-full)",
    },
    // ⚠️ As chaves de `borderWidth` NÃO podem repetir chaves de `borderColor`.
    // O Tailwind registra `border-<chave>` nos dois plugins: com a mesma chave
    // nos dois, `border-strong` emitiria `border-width: 2px` E
    // `border-color: …` ao mesmo tempo, e todo `border border-strong` viraria
    // silenciosamente 2px. Por isso a largura forte se chama `2`.
    borderWidth: {
      DEFAULT: "var(--border-width)",
      0: "0",
      2: "var(--border-width-strong)",
    },
    outlineWidth: {
      DEFAULT: "var(--border-width)",
      2: "var(--border-width-strong)",
    },
    borderColor: {
      ...cores,
      DEFAULT: cor("--color-border-default"),
      subtle: cor("--color-border-subtle"),
      strong: cor("--color-border-strong"),
    },
    // Elevação nomeada por intenção, nunca por tamanho. Ver tokens.css §8.
    boxShadow: {
      none: "none",
      raised: "var(--elevation-raised)",
      overlay: "var(--elevation-overlay)",
      modal: "var(--elevation-modal)",
    },

    transitionDuration: {
      instant: "var(--duration-instant)",
      fast: "var(--duration-fast)",
      base: "var(--duration-base)",
      slow: "var(--duration-slow)",
      chart: "var(--duration-chart)",
    },
    transitionTimingFunction: {
      out: "var(--ease-out)",
      spring: "var(--ease-spring)",
      emphasized: "var(--ease-emphasized)",
    },

    zIndex: {
      base: "var(--z-base)",
      sticky: "var(--z-sticky)",
      dropdown: "var(--z-dropdown)",
      overlay: "var(--z-overlay)",
      modal: "var(--z-modal)",
      toast: "var(--z-toast)",
      auto: "auto",
    },

    // O que sobra do default é mantido, porque não carrega decisão de design
    // (grid, flex, opacidade, largura...).
    extend: {
      // Largura de leitura e largura de painel não são espaçamento — não
      // pertencem à escala de 4px, e por isso ficam nomeadas aqui.
      maxWidth: { prose: "68ch" },
      minWidth: { menu: "12rem", campo: "14rem" },
      screens: { xs: "375px" },
    },
  },
  plugins: [],
} satisfies Config;
