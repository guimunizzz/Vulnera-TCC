/**
 * icon-avatar.tsx
 *
 * Chip circular colorido com ícone dentro — o "avatar de categoria" que dá
 * às linhas de lista (ProjectCard, FindingRow) a densidade visual do
 * Mercado Livre (cada item com um ícone identificável de relance, não só
 * texto). Cor vem do próprio vocabulário de severidade/acento já definido
 * em tokens.ts — não inventa tom novo. Sólido, sem gradiente.
 */

import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { COLORS, RADIUS } from "../theme/tokens";

export type IoniconsGlyph = ComponentProps<typeof Ionicons>["name"];

export type IconAvatarTone = "accent" | "critical" | "high" | "medium" | "low" | "success" | "neutral";

const TONES: Record<IconAvatarTone, { bg: string; fg: string }> = {
  accent: { bg: COLORS.accentSurface, fg: COLORS.accentInk },
  critical: { bg: COLORS.severity.criticalSurface, fg: COLORS.severity.critical },
  high: { bg: COLORS.severity.highSurface, fg: COLORS.severity.high },
  medium: { bg: COLORS.severity.mediumSurface, fg: COLORS.severity.medium },
  low: { bg: COLORS.severity.lowSurface, fg: COLORS.severity.low },
  success: { bg: COLORS.successSurface, fg: COLORS.successInk },
  neutral: { bg: COLORS.raised, fg: COLORS.textMuted },
};

export function IconAvatar({
  name,
  tone = "neutral",
  size = 44,
}: {
  name: IoniconsGlyph;
  tone?: IconAvatarTone;
  size?: number;
}) {
  const cor = TONES[tone];
  const iconSize = Math.round(size * 0.5);
  const shapeStyle = { width: size, height: size, borderRadius: RADIUS.full };

  return (
    <View style={[styles.wrap, shapeStyle, { backgroundColor: cor.bg }]}>
      <Ionicons name={name} size={iconSize} color={cor.fg} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
  },
});
