/**
 * badge.tsx — SeverityBadge e StatusBadge
 *
 * Mesmo vocabulário PT-BR de app/web/src/components/ui/badge.tsx
 * (ROTULO_SEVERIDADE/ROTULO_ESTADO), com cores calibradas por tema (escuro
 * e claro) segundo tokens.css para manter contraste WCAG AA em ambos.
 * Consumidores: listas e detalhes de projetos, achados e relatórios.
 */

import { Platform, StyleSheet, Text, View } from "react-native";
import { BlurView } from "expo-blur";
import { COLORS, FONT_FAMILY, RADIUS, SPACING } from "../theme/tokens";
import { useAppTheme, type AppColors } from "../theme/use-app-theme";

type Severidade = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "NONE";

export const ROTULO_SEVERIDADE: Record<Severidade, string> = {
  CRITICAL: "Crítica",
  HIGH: "Alta",
  MEDIUM: "Média",
  LOW: "Baixa",
  NONE: "Informativa",
};

export function getSeverityColors(
  colors: AppColors,
): Record<Severidade, { fundo: string; texto: string; ponto: string }> {
  return {
    CRITICAL: { fundo: colors.severity.criticalSurface, texto: colors.severity.criticalInk, ponto: colors.severity.critical },
    HIGH: { fundo: colors.severity.highSurface, texto: colors.severity.highInk, ponto: colors.severity.high },
    MEDIUM: { fundo: colors.severity.mediumSurface, texto: colors.severity.mediumInk, ponto: colors.severity.medium },
    LOW: { fundo: colors.severity.lowSurface, texto: colors.severity.lowInk, ponto: colors.severity.low },
    NONE: { fundo: colors.severity.infoSurface, texto: colors.severity.infoInk, ponto: colors.severity.info },
  };
}

export const CORES_SEVERIDADE = getSeverityColors(COLORS);

export function SeverityBadge({ severidade, cvss }: { severidade: string; cvss?: number | null }) {
  const { isDark, colors, workspace } = useAppTheme();
  const palette = getSeverityColors(colors);
  const s = (severidade in palette ? severidade : "NONE") as Severidade;
  const cor = palette[s];

  return (
    <View style={styles.chip}>
      {Platform.OS !== "android" && <BlurView intensity={25} tint={workspace.blurTint} style={StyleSheet.absoluteFill} />}
      <View style={[styles.chipTint, { backgroundColor: cor.fundo, opacity: isDark ? 0.78 : 0.94 }]} />
      <View style={[styles.ponto, { backgroundColor: cor.ponto }]} />
      <Text style={[styles.texto, { color: cor.texto }]}>{ROTULO_SEVERIDADE[s]}</Text>
      {cvss != null && <Text style={[styles.cvss, { color: cor.texto }]}>{cvss.toFixed(1)}</Text>}
    </View>
  );
}

type TomBadge = "neutro" | "informacao" | "sucesso" | "atencao" | "perigo";

function getToneColors(colors: AppColors): Record<TomBadge, { fundo: string; texto: string }> {
  return {
    neutro: { fundo: colors.severity.infoSurface, texto: colors.severity.infoInk },
    informacao: { fundo: colors.severity.lowSurface, texto: colors.severity.lowInk },
    sucesso: { fundo: colors.successSurface, texto: colors.successInk },
    atencao: { fundo: colors.severity.mediumSurface, texto: colors.severity.mediumInk },
    perigo: { fundo: colors.dangerSurface, texto: colors.dangerInk },
  };
}

export const ROTULO_ESTADO: Record<string, { texto: string; tom: TomBadge }> = {
  OPEN: { texto: "Aberto", tom: "perigo" },
  IN_PROGRESS: { texto: "Em andamento", tom: "atencao" },
  FIXED: { texto: "Corrigido", tom: "sucesso" },
  CLOSED: { texto: "Fechado", tom: "neutro" },
  PENDING: { texto: "Pendente", tom: "atencao" },
  IN_REVIEW: { texto: "Em revisão", tom: "informacao" },
  COMPLETED: { texto: "Concluído", tom: "sucesso" },
};

export function StatusBadge({ status }: { status: string }) {
  const { isDark, colors, workspace } = useAppTheme();
  const info = ROTULO_ESTADO[status] ?? { texto: status, tom: "neutro" as TomBadge };
  const cor = getToneColors(colors)[info.tom];
  return (
    <View style={styles.chip}>
      {Platform.OS !== "android" && <BlurView intensity={25} tint={workspace.blurTint} style={StyleSheet.absoluteFill} />}
      <View style={[styles.chipTint, { backgroundColor: cor.fundo, opacity: isDark ? 0.78 : 0.94 }]} />
      <Text style={[styles.texto, { color: cor.texto }]}>{info.texto}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING[1],
    paddingHorizontal: SPACING[3],
    paddingVertical: SPACING[1] + 2,
    borderRadius: RADIUS.full,
    alignSelf: "flex-start",
    overflow: "hidden",
  },
  chipTint: {
    ...StyleSheet.absoluteFill,
  },
  ponto: {
    width: 6,
    height: 6,
    borderRadius: RADIUS.full,
  },
  texto: {
    fontSize: 12,
    fontFamily: FONT_FAMILY.medium,
    lineHeight: 18,
  },
  cvss: {
    fontSize: 12,
    fontFamily: FONT_FAMILY.mono,
    fontVariant: ["tabular-nums"],
    opacity: 0.85,
  },
});
