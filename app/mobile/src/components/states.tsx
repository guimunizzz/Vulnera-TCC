/**
 * states.tsx — LoadingState, EmptyState, ErrorState
 *
 * Toda tela que busca dado tem 3 desfechos possíveis além do sucesso:
 * carregando, vazio, erro. Centralizar os três aqui é o que faz a "atenção
 * ao CSS" pedida na Fase 7 render igual em Home/ProjectDetail/FindingDetail
 * em vez de cada tela inventar o próprio spinner.
 */

import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { COLORS, FONT_SIZE, SPACING } from "../theme/tokens";
import { Button } from "./button";

export function LoadingState({ label = "Carregando..." }: { label?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={COLORS.accentInk} size="large" />
      <Text style={styles.mutedText}>{label}</Text>
    </View>
  );
}

export function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.center}>
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.mutedText}>{subtitle}</Text>}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.center}>
      <Text style={styles.errorText}>{message}</Text>
      {onRetry && <Button onPress={onRetry} variant="secundario">Tentar de novo</Button>}
    </View>
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
  title: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZE.base,
    fontWeight: "600",
    textAlign: "center",
  },
  mutedText: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.sm,
    textAlign: "center",
  },
  errorText: {
    color: COLORS.dangerInk,
    fontSize: FONT_SIZE.sm,
    textAlign: "center",
  },
});
