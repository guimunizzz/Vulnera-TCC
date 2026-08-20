/**
 * badge.tsx — SeverityBadge e StatusBadge
 *
 * Mesmo vocabulário PT-BR de app/web/src/components/ui/badge.tsx
 * (ROTULO_SEVERIDADE/ROTULO_ESTADO) — um pentester ou cliente que já usa o
 * web não deve encontrar um termo diferente no app. Cor nunca sozinha: todo
 * chip carrega o texto do nível, o ponto colorido é reforço visual, não a
 * única pista (mesmo princípio de acessibilidade do web).
 */

import { StyleSheet, Text, View } from "react-native";
import { COLORS, FONT_SIZE, FONT_WEIGHT, RADIUS, SPACING } from "../theme/tokens";

export type Severidade = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "NONE";

const ROTULO_SEVERIDADE: Record<Severidade, string> = {
  CRITICAL: "Crítica",
  HIGH: "Alta",
  MEDIUM: "Média",
  LOW: "Baixa",
  NONE: "Informativa",
};

const CORES_SEVERIDADE: Record<Severidade, { fundo: string; texto: string; ponto: string }> = {
  CRITICAL: { fundo: COLORS.severity.criticalSurface, texto: COLORS.severity.criticalInk, ponto: COLORS.severity.critical },
  HIGH: { fundo: COLORS.severity.highSurface, texto: COLORS.severity.highInk, ponto: COLORS.severity.high },
  MEDIUM: { fundo: COLORS.severity.mediumSurface, texto: COLORS.severity.mediumInk, ponto: COLORS.severity.medium },
  LOW: { fundo: COLORS.severity.lowSurface, texto: COLORS.severity.lowInk, ponto: COLORS.severity.low },
  NONE: { fundo: COLORS.severity.infoSurface, texto: COLORS.severity.infoInk, ponto: COLORS.severity.info },
};

export function SeverityBadge({ severidade, cvss }: { severidade: string; cvss?: number | null }) {
  const s = (severidade in CORES_SEVERIDADE ? severidade : "NONE") as Severidade;
  const cor = CORES_SEVERIDADE[s];

  return (
    <View style={[styles.chip, { backgroundColor: cor.fundo }]}>
      <View style={[styles.ponto, { backgroundColor: cor.ponto }]} />
      <Text style={[styles.texto, { color: cor.texto }]}>{ROTULO_SEVERIDADE[s]}</Text>
      {cvss != null && <Text style={[styles.cvss, { color: cor.texto }]}>{cvss.toFixed(1)}</Text>}
    </View>
  );
}

type TomBadge = "neutro" | "acento" | "sucesso" | "atencao" | "perigo";

const TONS: Record<TomBadge, { fundo: string; texto: string }> = {
  neutro: { fundo: COLORS.severity.infoSurface, texto: COLORS.severity.infoInk },
  acento: { fundo: COLORS.accentSurface, texto: COLORS.accentInk },
  sucesso: { fundo: COLORS.successSurface, texto: COLORS.successInk },
  atencao: { fundo: COLORS.severity.mediumSurface, texto: COLORS.severity.mediumInk },
  perigo: { fundo: COLORS.dangerSurface, texto: COLORS.dangerInk },
};

// Mesmo mapa de app/web/src/components/ui/badge.tsx (ROTULO_ESTADO) — só os
// estados que o finding/projeto realmente assume (máquinas de 4 estados).
const ROTULO_ESTADO: Record<string, { texto: string; tom: TomBadge }> = {
  OPEN: { texto: "Aberto", tom: "perigo" },
  IN_PROGRESS: { texto: "Em andamento", tom: "atencao" },
  FIXED: { texto: "Corrigido", tom: "sucesso" },
  CLOSED: { texto: "Fechado", tom: "neutro" },
  PENDING: { texto: "Pendente", tom: "neutro" },
  IN_REVIEW: { texto: "Em revisão", tom: "acento" },
  COMPLETED: { texto: "Concluído", tom: "sucesso" },
};

export function StatusBadge({ status }: { status: string }) {
  const info = ROTULO_ESTADO[status] ?? { texto: status, tom: "neutro" as TomBadge };
  const cor = TONS[info.tom];
  return (
    <View style={[styles.chip, { backgroundColor: cor.fundo }]}>
      <Text style={[styles.texto, { color: cor.texto }]}>{info.texto}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING[1],
    paddingHorizontal: SPACING[2],
    paddingVertical: SPACING[1],
    borderRadius: RADIUS.full,
    alignSelf: "flex-start",
  },
  ponto: {
    width: 6,
    height: 6,
    borderRadius: RADIUS.full,
  },
  texto: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.medium,
    textTransform: "uppercase",
  },
  cvss: {
    fontSize: FONT_SIZE.xs,
    fontVariant: ["tabular-nums"],
    opacity: 0.85,
  },
});
