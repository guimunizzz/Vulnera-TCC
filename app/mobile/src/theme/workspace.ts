/**
 * Identidade visual da área autenticada: vidro suave, violeta e escala legível.
 * Existe separadamente dos tokens anteriores para preservar o login.
 * Consumidores: telas e componentes de acompanhamento do cliente.
 */
import { StyleSheet } from "react-native";
import { COLORS, FONT_FAMILY } from "./tokens";

export const WORKSPACE = {
  background: "#100e19", glass: "rgba(39,34,53,0.50)", glassStrong: "rgba(56,44,78,0.54)",
  line: "rgba(216,199,255,0.11)", shine: "rgba(237,228,255,0.16)", muted: "#b3a9c3", text: "#f6f2ff",
  purple: COLORS.accent, lavender: COLORS.accentInk, radius: 24,
} as const;

export const workspaceStyles = StyleSheet.create({
  eyebrow: { color: "#bba4ef", fontFamily: FONT_FAMILY.medium, fontSize: 12, letterSpacing: 0.8, lineHeight: 18 },
  title: { color: WORKSPACE.text, fontFamily: FONT_FAMILY.semibold, fontSize: 28, letterSpacing: -0.6, lineHeight: 36 },
  heading: { color: WORKSPACE.text, fontFamily: FONT_FAMILY.semibold, fontSize: 18, letterSpacing: -0.2, lineHeight: 26 },
  body: { color: "#d4ccdf", fontFamily: FONT_FAMILY.regular, fontSize: 15, lineHeight: 24 },
  muted: { color: WORKSPACE.muted, fontFamily: FONT_FAMILY.regular, fontSize: 13, lineHeight: 20 },
  mono: { color: WORKSPACE.lavender, fontFamily: FONT_FAMILY.mono, fontSize: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  spread: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  grow: { flex: 1, minWidth: 0 }, divider: { height: 1, backgroundColor: WORKSPACE.line },
});
