import { Platform, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import type { ComponentProps } from "react";
import { RADIUS } from "../theme/tokens";
import { useAppTheme, type AppColors } from "../theme/use-app-theme";

export type IoniconsGlyph = ComponentProps<typeof Ionicons>["name"];

export type IconAvatarTone = "accent" | "critical" | "high" | "medium" | "low" | "success" | "neutral";

function getTones(colors: AppColors): Record<IconAvatarTone, { bg: string; fg: string }> {
  return {
    accent: { bg: colors.accentSurface, fg: colors.accentInk },
    critical: { bg: colors.severity.criticalSurface, fg: colors.severity.critical },
    high: { bg: colors.severity.highSurface, fg: colors.severity.high },
    medium: { bg: colors.severity.mediumSurface, fg: colors.severity.medium },
    low: { bg: colors.severity.lowSurface, fg: colors.severity.low },
    success: { bg: colors.successSurface, fg: colors.successInk },
    neutral: { bg: colors.inset, fg: colors.textMuted },
  };
}

export function IconAvatar({
  name,
  tone = "neutral",
  size = 44,
}: {
  name: IoniconsGlyph;
  tone?: IconAvatarTone;
  size?: number;
}) {
  const { colors, workspace } = useAppTheme();
  const cor = getTones(colors)[tone];
  const iconSize = Math.round(size * 0.5);
  const shapeStyle = { width: size, height: size, borderRadius: RADIUS.full };

  return (
    <View style={[styles.wrap, shapeStyle]}>
      {Platform.OS !== "android" && <BlurView intensity={30} tint={workspace.blurTint} style={StyleSheet.absoluteFill} />}
      <View style={[styles.tint, { backgroundColor: cor.bg }]} />
      <Ionicons name={name} size={iconSize} color={cor.fg} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  tint: {
    ...StyleSheet.absoluteFill,
    opacity: 0.75,
  },
});
