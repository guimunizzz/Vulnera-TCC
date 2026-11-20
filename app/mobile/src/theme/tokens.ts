/**
 * theme/tokens.ts
 *
 * Paleta roxa escura do mobile. Define as superfícies, os detalhes da
 * identidade e as cores semânticas de alertas e severidade.
 *
 * Fontes customizadas (Archivo/JetBrains Mono) — carregadas via
 * @expo-google-fonts/* e expo-font no app/_layout.tsx raiz, com guarda de
 * loading antes do primeiro render (ver useFonts lá).
 */

export const COLORS = {
  canvas: "#140e1d",
  surface: "#1d1428",
  raised: "#271a35",
  inset: "#170f21",

  // --- texto (neutro) ---
  textPrimary: "#f7f4fa",
  textSecondary: "#d7d1da",
  textMuted: "#bcb4c1",

  // --- bordas (neutro) ---
  borderSubtle: "#342445",
  borderDefault: "#463259",
  borderStrong: "#7b6591",

  // --- ação (violeta — só pra detalhe: CTA, link, ícone/estado ativo) ---
  accent: "#573185",
  accentHover: "#643698",
  accentFg: "#ffffff",
  accentInk: "#9d77d0",
  accentSurface: "#261833",
  brandMark: { start: "#8852bb", end: "#7540a4" },
  chartCreated: "#986bc8",
  chartResolved: "#7f56b3",

  // --- estados ---
  success: "#16a34a",
  successInk: "#6ee7a0",
  successSurface: "#052e16",
  danger: "#dc2626",
  dangerInk: "#fca5a5",
  dangerSurface: "#2f0a0a",

  // --- severidade (mesma semântica do web, tons sólidos e mais escuros) ---
  severity: {
    critical: "#e11d48",
    criticalInk: "#fda4af",
    criticalSurface: "#2a0512",
    high: "#ea580c",
    highInk: "#fdba74",
    highSurface: "#2b1103",
    medium: "#ca8a04",
    mediumInk: "#fde68a",
    mediumSurface: "#2a2002",
    low: "#0284c7",
    lowInk: "#7dd3fc",
    lowSurface: "#041f2e",
    info: "#71717a",
    infoInk: "#d4d4d8",
    infoSurface: "#1c1c1f",
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
  control: 16, // botão, input, chip
  container: 24, // card, painel
  overlay: 26, // modal, diálogo
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

/**
 * Nomes de família exatamente como o useFonts() registra (chave passada pro
 * hook em app/_layout.tsx) — RN resolve fonte por nome de família, não por
 * peso numérico em cima de uma família só, então cada peso é uma "família"
 * separada aqui.
 */
export const FONT_FAMILY = {
  regular: "Archivo_400Regular",
  medium: "Archivo_500Medium",
  semibold: "Archivo_600SemiBold",
  bold: "Archivo_700Bold",
  mono: "JetBrainsMono_400Regular",
  // Só pro lockup da marca (wordmark VULNERA) — mesmo peso 700 do
  // Lockup.dc.html original.
  monoBold: "JetBrainsMono_700Bold",
} as const;

/**
 * Sombra — `card` é a elevação padrão, `raised` pra hero/modal, `glow` é um
 * brilho colorido (cor do acento) reservado pra CTA primário e elementos que
 * devem "chamar o olho" — uso pontual, não em todo card.
 */
export const SHADOW = {
  card: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 3,
  },
  raised: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 10,
  },
  glow: {
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
} as const;

/**
 * Duração/easing padrão pra Reanimated — usar em vez de valores soltos
 * espalhados pelas telas, pra toda transição do app ter o mesmo "peso".
 */
export const MOTION = {
  fast: 150,
  base: 250,
  slow: 400,
} as const;

/** WCAG 2.5.5/2.5.8 — todo controle interativo alcança 44px, igual ao web (--size-touch-target). */
export const TOUCH_TARGET = 44;

/**
 * Dimensões da tab bar flutuante (pill com glassmorphism, ver
 * app/(tabs)/_layout.tsx) — exportado porque as telas com FlatList/
 * ScrollView dentro das abas (home/index.tsx, settings.tsx) precisam desse
 * mesmo número pra reservar espaço no rodapé e não deixar o último item
 * escondido atrás do pill (que agora flutua por cima do conteúdo, não
 * empurra mais como a barra dockada antiga fazia).
 */
export const TAB_BAR = {
  width: 176,
  height: 56,
  sideMargin: 16,
  bottomMargin: 16,
} as const;
