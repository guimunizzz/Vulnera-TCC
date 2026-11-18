/**
 * theme/use-app-theme.ts
 *
 * Resolve os tokens semânticos de cor, superfícies de vidro e estilos base
 * conforme o tema ativo ("dark" padrão ou "light" branco/claro).
 * A paleta clara espelha `app/web/src/styles/tokens.css` (`[data-theme="light"]`),
 * garantindo contraste WCAG AA em textos, bordas e severidades sobre fundo claro.
 * Consumidores: layouts, telas e componentes visuais de todo o app mobile.
 */

import { useMemo } from "react";
import { StyleSheet } from "react-native";
import { useThemeStore, type ThemeMode } from "../store/theme.store";
import { COLORS, FONT_FAMILY } from "./tokens";

export interface AppColors {
  canvas: string;
  surface: string;
  raised: string;
  inset: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  borderSubtle: string;
  borderDefault: string;
  borderStrong: string;
  accent: string;
  accentHover: string;
  accentFg: string;
  accentInk: string;
  accentSurface: string;
  success: string;
  successInk: string;
  successSurface: string;
  danger: string;
  dangerInk: string;
  dangerSurface: string;
  severity: {
    critical: string;
    criticalInk: string;
    criticalSurface: string;
    high: string;
    highInk: string;
    highSurface: string;
    medium: string;
    mediumInk: string;
    mediumSurface: string;
    low: string;
    lowInk: string;
    lowSurface: string;
    info: string;
    infoInk: string;
    infoSurface: string;
  };
}

export interface AppWorkspace {
  background: string;
  glass: string;
  glassStrong: string;
  glassAndroid: string;
  glassStrongAndroid: string;
  tabGlass: string;
  tabGlassAndroid: string;
  tabBorder: string;
  line: string;
  shine: string;
  muted: string;
  text: string;
  secondary: string;
  inset: string;
  neutralTint: string;
  searchBg: string;
  searchFocusBg: string;
  searchFocusBorder: string;
  chipBg: string;
  chipActiveBg: string;
  chipActiveBorder: string;
  actionBg: string;
  actionBorder: string;
  dangerActionBg: string;
  dangerActionBorder: string;
  dangerInk: string;
  purple: string;
  lavender: string;
  successAccent: string;
  stageDoneBg: string;
  stageDoneBorder: string;
  mediaWell: string;
  radius: number;
  blurTint: "dark" | "light";
  statusBarStyle: "light" | "dark";
}

const DARK_COLORS: AppColors = COLORS;

const LIGHT_COLORS: AppColors = {
  canvas: "#f4f5f8",
  surface: "#ffffff",
  raised: "#ffffff",
  inset: "#eceef4",
  textPrimary: "#181a20",
  textSecondary: "#3f4451",
  textMuted: "#5d6472",
  borderSubtle: "#e2e5ed",
  borderDefault: "#cfd4df",
  borderStrong: "#6e7685",
  accent: "#7046cf",
  accentHover: "#5b2bb5",
  accentFg: "#ffffff",
  accentInk: "#5b2bb5",
  accentSurface: "#f3f0fc",
  success: "#187c49",
  successInk: "#116339",
  successSurface: "#e8fbee",
  danger: "#c11c1f",
  dangerInk: "#9b1416",
  dangerSurface: "#faf3f2",
  severity: {
    critical: "#c11c1f",
    criticalInk: "#9b1416",
    criticalSurface: "#f7e3e1",
    high: "#9c5313",
    highInk: "#7d410d",
    highSurface: "#f7e5d9",
    medium: "#836414",
    mediumInk: "#4e3a0b",
    mediumSurface: "#f6e7c7",
    low: "#1464cd",
    lowInk: "#0e4fa5",
    lowSurface: "#e0e9f6",
    info: "#6e7685",
    infoInk: "#3f4451",
    infoSurface: "#e4e7ee",
  },
};

const DARK_WORKSPACE: AppWorkspace = {
  background: "#101113",
  glass: "rgba(34,36,40,0.58)",
  glassStrong: "rgba(43,46,51,0.62)",
  glassAndroid: "rgba(26,28,33,0.90)",
  glassStrongAndroid: "rgba(33,36,42,0.94)",
  tabGlass: "rgba(29,31,36,0.68)",
  tabGlassAndroid: "rgba(24,26,31,0.94)",
  tabBorder: "rgba(255,255,255,0.17)",
  line: "rgba(255,255,255,0.10)",
  shine: "rgba(255,255,255,0.17)",
  muted: "#a8acb5",
  text: "#f5f6f8",
  secondary: "#c9ccd3",
  inset: "#1b1d21",
  neutralTint: "rgba(255,255,255,0.045)",
  searchBg: "rgba(255,255,255,0.025)",
  searchFocusBg: "rgba(124,58,237,0.065)",
  searchFocusBorder: "rgba(167,139,250,0.5)",
  chipBg: "rgba(255,255,255,0.025)",
  chipActiveBg: "rgba(124,58,237,0.20)",
  chipActiveBorder: "rgba(167,139,250,0.24)",
  actionBg: "rgba(124,58,237,0.12)",
  actionBorder: "rgba(167,139,250,0.25)",
  dangerActionBg: "rgba(225,29,72,0.06)",
  dangerActionBorder: "rgba(253,164,175,0.18)",
  dangerInk: "#fda4af",
  purple: "#7c3aed",
  lavender: "#a78bfa",
  successAccent: "#6ee7a0",
  stageDoneBg: "#34383e",
  stageDoneBorder: "rgba(255,255,255,0.2)",
  mediaWell: "rgba(0,0,0,0.25)",
  radius: 24,
  blurTint: "dark",
  statusBarStyle: "light",
};

const LIGHT_WORKSPACE: AppWorkspace = {
  background: "#f3f4f8",
  glass: "rgba(255,255,255,0.84)",
  glassStrong: "rgba(255,255,255,0.94)",
  glassAndroid: "#ffffff",
  glassStrongAndroid: "#ffffff",
  tabGlass: "rgba(255,255,255,0.86)",
  tabGlassAndroid: "#ffffff",
  tabBorder: "rgba(24,26,32,0.12)",
  line: "rgba(24,26,32,0.09)",
  shine: "rgba(255,255,255,0.90)",
  muted: "#5d6472",
  text: "#181a20",
  secondary: "#3f4451",
  inset: "#ebedf3",
  neutralTint: "rgba(24,26,32,0.05)",
  searchBg: "#ffffff",
  searchFocusBg: "rgba(112,70,207,0.06)",
  searchFocusBorder: "rgba(112,70,207,0.45)",
  chipBg: "#ffffff",
  chipActiveBg: "rgba(112,70,207,0.12)",
  chipActiveBorder: "rgba(112,70,207,0.32)",
  actionBg: "rgba(112,70,207,0.09)",
  actionBorder: "rgba(112,70,207,0.26)",
  dangerActionBg: "rgba(193,28,31,0.07)",
  dangerActionBorder: "rgba(193,28,31,0.24)",
  dangerInk: "#9b1416",
  purple: "#7046cf",
  lavender: "#5b2bb5",
  successAccent: "#187c49",
  stageDoneBg: "#dfe3ec",
  stageDoneBorder: "rgba(24,26,32,0.16)",
  mediaWell: "rgba(24,26,32,0.05)",
  radius: 24,
  blurTint: "light",
  statusBarStyle: "dark",
};

function createThemedUiStyles(w: AppWorkspace) {
  return StyleSheet.create({
    eyebrow: { color: w.muted, fontFamily: FONT_FAMILY.medium, fontSize: 12, letterSpacing: 0.8, lineHeight: 18 },
    title: { color: w.text, fontFamily: FONT_FAMILY.semibold, fontSize: 28, letterSpacing: -0.6, lineHeight: 36 },
    heading: { color: w.text, fontFamily: FONT_FAMILY.semibold, fontSize: 18, letterSpacing: -0.2, lineHeight: 26 },
    body: { color: w.secondary, fontFamily: FONT_FAMILY.regular, fontSize: 15, lineHeight: 24 },
    muted: { color: w.muted, fontFamily: FONT_FAMILY.regular, fontSize: 13, lineHeight: 20 },
    mono: { color: w.muted, fontFamily: FONT_FAMILY.mono, fontSize: 12 },
    row: { flexDirection: "row", alignItems: "center", gap: 12 },
    spread: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
    grow: { flex: 1, minWidth: 0 },
    divider: { height: 1, backgroundColor: w.line },
  });
}

const DARK_UI = createThemedUiStyles(DARK_WORKSPACE);
const LIGHT_UI = createThemedUiStyles(LIGHT_WORKSPACE);

export function getAppTheme(mode: ThemeMode) {
  const isDark = mode === "dark";
  return {
    mode,
    isDark,
    colors: isDark ? DARK_COLORS : LIGHT_COLORS,
    workspace: isDark ? DARK_WORKSPACE : LIGHT_WORKSPACE,
    ui: isDark ? DARK_UI : LIGHT_UI,
  };
}

export function useAppTheme() {
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);
  const toggleMode = useThemeStore((s) => s.toggleMode);
  return useMemo(() => ({ ...getAppTheme(mode), setMode, toggleMode }), [mode, setMode, toggleMode]);
}
