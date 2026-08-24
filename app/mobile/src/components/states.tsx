/**
 * states.tsx — LoadingState, EmptyState, ErrorState
 *
 * Toda tela que busca dado tem 3 desfechos possíveis além do sucesso:
 * carregando, vazio, erro. Centralizar os três aqui é o que faz a "atenção
 * ao CSS" pedida na Fase 7 render igual em Home/ProjectDetail/FindingDetail
 * em vez de cada tela inventar o próprio spinner.
 */

import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";
import { COLORS, FONT_FAMILY, FONT_SIZE, RADIUS, SPACING } from "../theme/tokens";
import { Button } from "./button";

export function LoadingState({ label = "Carregando..." }: { label?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={COLORS.accentInk} size="large" />
      <Text style={styles.mutedText}>{label}</Text>
    </View>
  );
}

/**
 * Ilustração em camadas (mancha grande translúcida + círculo sólido com
 * ícone) em vez de um ícone solto — dá mais "corpo" ao estado vazio sem
 * precisar de um pacote de SVG/ilustração externo.
 */
function Blob({
  glyph,
  tint,
  tintSurface,
}: {
  glyph: keyof typeof Ionicons.glyphMap;
  tint: string;
  tintSurface: string;
}) {
  return (
    <Animated.View entering={ZoomIn.duration(420)} style={styles.blobWrap}>
      <View style={[styles.blobHalo, { backgroundColor: tintSurface }]} />
      <View style={[styles.blobCore, { backgroundColor: tintSurface, borderColor: tint }]}>
        <Ionicons name={glyph} size={30} color={tint} />
      </View>
    </Animated.View>
  );
}

export function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.center}>
      <Blob glyph="file-tray-outline" tint={COLORS.accentInk} tintSurface={COLORS.accentSurface} />
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.mutedText}>{subtitle}</Text>}
    </Animated.View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.center}>
      <Blob glyph="alert-circle-outline" tint={COLORS.dangerInk} tintSurface={COLORS.dangerSurface} />
      <Text style={styles.errorText}>{message}</Text>
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
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZE.base,
    fontFamily: FONT_FAMILY.semibold,
    textAlign: "center",
  },
  mutedText: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.sm,
    fontFamily: FONT_FAMILY.regular,
    textAlign: "center",
  },
  errorText: {
    color: COLORS.dangerInk,
    fontSize: FONT_SIZE.sm,
    fontFamily: FONT_FAMILY.medium,
    textAlign: "center",
  },
});
