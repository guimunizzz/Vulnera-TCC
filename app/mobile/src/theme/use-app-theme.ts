/**
 * theme/use-app-theme.ts
 *
 * Resolve a mesma paleta semântica para login, navegação e área autenticada.
 * Consumidores: layouts, telas e componentes visuais de todo o app mobile.
 */

import { useMemo } from "react";
import { StyleSheet } from "react-native";
import { DEFAULT_THEME_MODE, useThemeStore, type ThemeMode } from "../store/theme.store";
import type { SlaState } from "../types/vulnerability.types";
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
  brandMark: { start: string; end: string };
  chartCreated: string;
  chartResolved: string;
  assistantInk: string;
  success: string;
  successInk: string;
  successSurface: string;
  danger: string;
  dangerInk: string;
  dangerSurface: string;
  warningInk: string;
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
  surface: string;
  raised: string;
  tabSurface: string;
  line: string;
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
  blurTint: "dark";
  statusBarStyle: "light";
}

const DEEP_COLORS: AppColors = {
  ...COLORS,
  canvas: "#0d0913",
  surface: "#160e20",
  raised: "#20132c",
  inset: "#110b19",
  borderSubtle: "#2d1f3a",
  borderDefault: "#3f2c50",
  accent: "#492875",
  accentHover: "#593486",
  accentSurface: "#221530",
};

function createTheme(colors: AppColors) {
  const workspace: AppWorkspace = {
    neutralTint: `${colors.accentInk}14`,
    mediaWell: "rgba(0,0,0,0.25)",
    blurTint: "dark",
    statusBarStyle: "light",
    background: colors.canvas,
    surface: colors.surface,
    raised: colors.raised,
    tabSurface: colors.raised,
    line: colors.borderSubtle,
    muted: colors.textMuted,
    text: colors.textPrimary,
    secondary: colors.textSecondary,
    inset: colors.inset,
    searchBg: colors.surface,
    searchFocusBg: colors.accentSurface,
    searchFocusBorder: colors.accentInk,
    chipBg: colors.surface,
    chipActiveBg: colors.accentSurface,
    chipActiveBorder: `${colors.accentInk}66`,
    actionBg: colors.accentSurface,
    actionBorder: `${colors.accentInk}66`,
    dangerActionBg: colors.dangerSurface,
    dangerActionBorder: `${colors.dangerInk}66`,
    dangerInk: colors.dangerInk,
    purple: colors.accent,
    lavender: colors.accentInk,
    successAccent: colors.successInk,
    stageDoneBg: colors.raised,
    stageDoneBorder: colors.borderDefault,
    radius: 24,
  };
  return { colors, workspace, ui: createThemedUiStyles(workspace) };
}

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

const themes = { dark: createTheme(COLORS), deep: createTheme(DEEP_COLORS) } satisfies Record<ThemeMode, ReturnType<typeof createTheme>>;

export function useAppTheme() {
  const mode = useThemeStore((state) => state.mode === "dark" ? "dark" : DEFAULT_THEME_MODE);
  const setMode = useThemeStore((s) => s.setMode);
  return useMemo(() => ({ ...themes[mode], mode, setMode }), [mode, setMode]);
}

export function getSlaInk(state: SlaState | undefined, colors: AppColors): string | undefined {
  if (state === "BREACHED") return colors.dangerInk;
  if (state === "DUE_SOON") return colors.warningInk;
  return undefined;
}
