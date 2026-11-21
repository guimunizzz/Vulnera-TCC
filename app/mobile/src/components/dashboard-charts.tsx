/**
 * Distribuições simples de achados e projetos, com contagens à vista.
 * Consumidor: aba Painel nas paletas Roxo profundo e Claro.
 */
import { StyleSheet, Text, View } from "react-native";
import { graphSeverities, type exposureOverview, type projectsByStatus } from "../lib/dashboard";
import { FONT_FAMILY } from "../theme/tokens";
import { useAppTheme } from "../theme/use-app-theme";

const severityLabels = { CRITICAL: "Críticos", HIGH: "Altos", MEDIUM: "Médios", LOW: "Baixos" } as const;
const number = new Intl.NumberFormat("pt-BR");

type ExposureOverview = ReturnType<typeof exposureOverview>;
type ProjectCounts = ReturnType<typeof projectsByStatus>;

export function OpenFindingsChart({ data }: { data: ExposureOverview }) {
  const { colors, ui, workspace } = useAppTheme();
  const severityColors = { CRITICAL: colors.severity.critical, HIGH: colors.severity.high, MEDIUM: colors.severity.medium, LOW: colors.severity.low };
  return <>
    <Text style={[styles.total, { color: workspace.text }]}>{number.format(data.total)}</Text>
    <View aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={[styles.distribution, { backgroundColor: workspace.line }]}>
      {graphSeverities.filter((severity) => data.bySeverity[severity] > 0).map((severity) =>
        <View key={severity} style={{ flex: data.bySeverity[severity], backgroundColor: severityColors[severity] }} />)}
    </View>
    <View style={styles.severities}>
      {graphSeverities.map((severity) => (
        <View key={severity} style={styles.severity}>
          <View style={[styles.swatch, { backgroundColor: severityColors[severity] }]} />
          <Text style={[ui.body, styles.legendText]}>
            <Text style={{ color: workspace.text, fontFamily: FONT_FAMILY.semibold }}>{number.format(data.bySeverity[severity])}</Text>
            {" " + severityLabels[severity]}
          </Text>
        </View>
      ))}
    </View>
  </>;
}

export function ProjectStagesChart({ counts, total }: { counts: ProjectCounts; total: number }) {
  const { colors, ui, workspace } = useAppTheme();
  if (!total) return <Text style={ui.body}>Nenhum projeto cadastrado.</Text>;

  const stages = [
    { label: "Pendentes", count: counts.PENDING, color: colors.warningInk },
    { label: "Em andamento", count: counts.IN_PROGRESS, color: colors.chartCreated },
    { label: "Em revisão", count: counts.IN_REVIEW, color: colors.assistantInk },
    { label: "Concluídos", count: counts.COMPLETED, color: colors.chartResolved },
  ];

  return <View style={styles.stages}>
    {stages.map(({ label, count, color }) => (
      <View key={label} style={styles.stage}>
        <View style={ui.spread}>
          <Text style={[ui.body, ui.grow]}>{label}</Text>
          <Text style={[ui.body, styles.stageCount, { color: workspace.text }]}>{number.format(count)}</Text>
        </View>
        <View aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
          style={[styles.stageTrack, { backgroundColor: workspace.line }]}>
          {count > 0 && <View style={[styles.stageFill, { backgroundColor: color, width: `${100 * count / total}%` }]} />}
        </View>
      </View>
    ))}
  </View>;
}

const styles = StyleSheet.create({
  total: { fontFamily: FONT_FAMILY.semibold, fontSize: 32, lineHeight: 38, letterSpacing: -1, fontVariant: ["tabular-nums"] },
  distribution: { flexDirection: "row", height: 12, borderRadius: 6, overflow: "hidden" },
  severities: { flexDirection: "row", flexWrap: "wrap", rowGap: 8 },
  severity: { flexDirection: "row", alignItems: "center", gap: 7, width: "50%", paddingRight: 6 },
  swatch: { width: 8, height: 8, borderRadius: 4 },
  legendText: { flexShrink: 1 },
  stages: { gap: 12 },
  stage: { gap: 5 },
  stageCount: { fontFamily: FONT_FAMILY.semibold, fontVariant: ["tabular-nums"] },
  stageTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
  stageFill: { height: "100%", borderRadius: 3 },
});
