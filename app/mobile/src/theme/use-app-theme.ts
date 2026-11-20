/**
 * theme/use-app-theme.ts
 *
 * Resolve a mesma paleta semântica para login, navegação e área autenticada.
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
  brandMark: { start: string; end: string };
  highlightInk: string;
  highlightSurface: string;
  highlightBorder: string;
  blueInk: string;
  mintInk: string;
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

const DARK_COLORS: AppColors = COLORS;

const LIGHT_COLORS: AppColors = {
  canvas: "#f7f5f8",
  surface: "#ffffff",
  raised: "#f5f0f8",
  inset: "#ede9ef",
  textPrimary: "#231e29",
  textSecondary: "#433a4a",
  textMuted: "#655a6c",
  borderSubtle: "#e9e2ec",
  borderDefault: "#d7cbdc",
  borderStrong: "#80728a",
  accent: "#6b379f",
  accentHover: "#582983",
  accentFg: "#ffffff",
  accentInk: "#542b82",
  accentSurface: "#f0e8f5",
  brandMark: { start: "#7b3fb0", end: "#4b1b74" },
  highlightInk: "#77501b",
  highlightSurface: "#fbf1df",
  highlightBorder: "#d7b980",
  blueInk: "#2f5d96",
  mintInk: "#256652",
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

const DARK_WORKSPACE = createWorkspace(DARK_COLORS, {
  neutralTint: "rgba(255,255,255,0.045)",
  mediaWell: "rgba(0,0,0,0.25)",
  blurTint: "dark",
  statusBarStyle: "light",
});

const LIGHT_WORKSPACE = createWorkspace(LIGHT_COLORS, {
  neutralTint: "rgba(24,26,32,0.05)",
  mediaWell: "rgba(24,26,32,0.05)",
  blurTint: "light",
  statusBarStyle: "dark",
});

function createWorkspace(colors: AppColors, material: Pick<AppWorkspace, "neutralTint" | "mediaWell" | "blurTint" | "statusBarStyle">): AppWorkspace {
  return {
    ...material,
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
