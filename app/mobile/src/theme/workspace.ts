/**
 * Identidade visual da área autenticada: vidro grafite e violeta nas ações.
 * Existe separadamente dos tokens anteriores para preservar o login.
 * Consumidores: telas e componentes de acompanhamento do cliente.
 */
import { StyleSheet } from "react-native";
import { COLORS, FONT_FAMILY } from "./tokens";

export const WORKSPACE = {
  background: "#101113", glass: "rgba(34,36,40,0.58)", glassStrong: "rgba(43,46,51,0.62)",
  line: "rgba(255,255,255,0.10)", shine: "rgba(255,255,255,0.17)", muted: "#a8acb5", text: "#f5f6f8",
  secondary: "#c9ccd3", inset: "#1b1d21", neutralTint: "rgba(255,255,255,0.045)",
  purple: COLORS.accent, lavender: COLORS.accentInk, radius: 24,
} as const;

export const workspaceStyles = StyleSheet.create({
  eyebrow: { color: WORKSPACE.muted, fontFamily: FONT_FAMILY.medium, fontSize: 12, letterSpacing: 0.8, lineHeight: 18 },
  title: { color: WORKSPACE.text, fontFamily: FONT_FAMILY.semibold, fontSize: 28, letterSpacing: -0.6, lineHeight: 36 },
  heading: { color: WORKSPACE.text, fontFamily: FONT_FAMILY.semibold, fontSize: 18, letterSpacing: -0.2, lineHeight: 26 },
  body: { color: WORKSPACE.secondary, fontFamily: FONT_FAMILY.regular, fontSize: 15, lineHeight: 24 },
  muted: { color: WORKSPACE.muted, fontFamily: FONT_FAMILY.regular, fontSize: 13, lineHeight: 20 },
  mono: { color: WORKSPACE.muted, fontFamily: FONT_FAMILY.mono, fontSize: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  spread: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  grow: { flex: 1, minWidth: 0 }, divider: { height: 1, backgroundColor: WORKSPACE.line },
});
