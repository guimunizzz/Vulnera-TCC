import { ActivityIndicator, Platform, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";
import { FONT_FAMILY, FONT_SIZE, RADIUS, SPACING } from "../theme/tokens";
import { useAppTheme } from "../theme/use-app-theme";
import { Button } from "./button";

export function LoadingState({ label = "Carregando..." }: { label?: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.accentInk} size="large" />
      <Text style={[styles.mutedText, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

function Blob({
  glyph,
  tint,
  tintSurface,
  blurTint,
}: {
  glyph: keyof typeof Ionicons.glyphMap;
  tint: string;
  tintSurface: string;
  blurTint: "dark" | "light";
}) {
  return (
    <Animated.View entering={ZoomIn.duration(420)} style={styles.blobWrap}>
      <View style={[styles.blobHalo, { backgroundColor: tintSurface }]} />
      <View style={[styles.blobCore, { borderColor: tint }]}>
        {Platform.OS !== "android" && <BlurView intensity={30} tint={blurTint} style={StyleSheet.absoluteFill} />}
        <View style={[styles.blobTint, { backgroundColor: tintSurface }]} />
        <Ionicons name={glyph} size={30} color={tint} />
      </View>
    </Animated.View>
  );
}

export function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  const { colors, workspace } = useAppTheme();
  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.center}>
      <Blob glyph="file-tray-outline" tint={colors.accentInk} tintSurface={colors.accentSurface} blurTint={workspace.blurTint} />
      <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
      {subtitle && <Text style={[styles.mutedText, { color: colors.textMuted }]}>{subtitle}</Text>}
    </Animated.View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { colors, workspace } = useAppTheme();
  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.center}>
      <Blob glyph="alert-circle-outline" tint={colors.dangerInk} tintSurface={colors.dangerSurface} blurTint={workspace.blurTint} />
      <Text style={[styles.errorText, { color: colors.dangerInk }]}>{message}</Text>
      {onRetry && <Button onPress={onRetry} variant="secundario">Tentar de novo</Button>}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING[3],
    paddingVertical: SPACING[12],
    paddingHorizontal: SPACING[6],
  },
  blobWrap: {
    width: 96,
    height: 96,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING[2],
  },
  blobHalo: {
    position: "absolute",
    width: 96,
    height: 96,
    borderRadius: RADIUS.full,
    opacity: 0.5,
  },
  blobCore: {
    width: 64,
    height: 64,
    borderRadius: RADIUS.full,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  blobTint: {
    ...StyleSheet.absoluteFill,
    opacity: 0.65,
  },
  title: {
    fontSize: FONT_SIZE.base,
    fontFamily: FONT_FAMILY.semibold,
    textAlign: "center",
  },
  mutedText: {
    fontSize: FONT_SIZE.sm,
    fontFamily: FONT_FAMILY.regular,
    textAlign: "center",
  },
  errorText: {
    fontSize: FONT_SIZE.sm,
    fontFamily: FONT_FAMILY.medium,
    textAlign: "center",
  },
});
