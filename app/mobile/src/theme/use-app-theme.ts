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
  blurTint: "dark" | "light";
  statusBarStyle: "light" | "dark";
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

const LIGHT_COLORS: AppColors = {
  canvas: "#f8f7f9",
  surface: "#ffffff",
  raised: "#f4f0f7",
  inset: "#f0edf2",
  textPrimary: "#241b2c",
  textSecondary: "#453b4d",
  textMuted: "#62596a",
  borderSubtle: "#e5dfe9",
  borderDefault: "#d1c5da",
  borderStrong: "#81738b",
  accent: "#492875",
  accentHover: "#3e1e68",
  accentFg: "#ffffff",
  accentInk: "#522a7e",
  accentSurface: "#eee8f4",
  brandMark: { start: "#6b4099", end: "#44236d" },
  chartCreated: "#67438e",
  chartResolved: "#26735b",
  assistantInk: "#285991",
  success: "#18744b",
  successInk: "#14613e",
  successSurface: "#e5f4ec",
  danger: "#ba2238",
  dangerInk: "#a11e31",
  dangerSurface: "#fbecee",
  warningInk: "#765019",
  severity: {
    critical: "#b61c40", criticalInk: "#98213b", criticalSurface: "#f8e5eb",
    high: "#a04a15", highInk: "#80390f", highSurface: "#faebdf",
    medium: "#886219", mediumInk: "#6f4f10", mediumSurface: "#f9f1db",
    low: "#2367a7", lowInk: "#20588e", lowSurface: "#e5eef9",
    info: "#625d6c", infoInk: "#51485d", infoSurface: "#eeeaf1",
  },
};

function createTheme(colors: AppColors, scheme: AppWorkspace["blurTint"]) {
  const workspace: AppWorkspace = {
    neutralTint: `${colors.accentInk}14`,
    mediaWell: scheme === "dark" ? "rgba(0,0,0,0.25)" : colors.inset,
    blurTint: scheme,
    statusBarStyle: scheme === "dark" ? "light" : "dark",
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

const themes = { deep: createTheme(DEEP_COLORS, "dark"), light: createTheme(LIGHT_COLORS, "light") } satisfies Record<ThemeMode, ReturnType<typeof createTheme>>;

export function useAppTheme() {
  const mode = useThemeStore((state) => state.mode === "light" ? "light" : DEFAULT_THEME_MODE);
  const setMode = useThemeStore((s) => s.setMode);
  return useMemo(() => ({ ...themes[mode], mode, setMode }), [mode, setMode]);
}

export function getSlaInk(state: SlaState | undefined, colors: AppColors): string | undefined {
  if (state === "BREACHED") return colors.dangerInk;
  if (state === "DUE_SOON") return colors.warningInk;
  return undefined;
}
