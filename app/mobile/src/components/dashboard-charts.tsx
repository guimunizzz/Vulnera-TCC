/**
 * Distribuições simples de achados e projetos, com contagens à vista.
 * Consumidor: aba Painel nas paletas Roxo profundo e Claro.
 */
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { graphSeverities, type exposureOverview, type projectsByStatus } from "../lib/dashboard";
import { FONT_FAMILY } from "../theme/tokens";
import { useAppTheme } from "../theme/use-app-theme";

const severityLabels = { CRITICAL: "Críticos", HIGH: "Altos", MEDIUM: "Médios", LOW: "Baixos" } as const;
const number = new Intl.NumberFormat("pt-BR");

type ExposureOverview = ReturnType<typeof exposureOverview>;
type ProjectCounts = ReturnType<typeof projectsByStatus>;

export function OpenFindingsChart({ data }: { data: ExposureOverview }) {
  const { colors, ui, workspace } = useAppTheme();
  const { width, fontScale } = useWindowDimensions();
  const total = number.format(data.total);
  const stacked = width < 320 || fontScale > 1.25 || total.length > 5;
  const severityColors = { CRITICAL: colors.severity.critical, HIGH: colors.severity.high, MEDIUM: colors.severity.medium, LOW: colors.severity.low };
  return <View style={[styles.findings, { backgroundColor: workspace.raised, borderColor: workspace.line }, stacked && styles.findingsStacked]}>
    <View style={styles.findingsTotal}>
      <Text style={[styles.total, { color: workspace.text }]}>{total}</Text>
      <Text style={ui.muted}>Total</Text>
    </View>
    <View style={[styles.findingsDistribution, stacked && styles.findingsDistributionStacked]}>
      <View aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
        style={[styles.distribution, { backgroundColor: workspace.line }]}>
        {graphSeverities.filter((severity) => data.bySeverity[severity] > 0).map((severity) =>
          <View key={severity} style={{ flex: data.bySeverity[severity], backgroundColor: severityColors[severity] }} />)}
      </View>
      <View style={styles.severities}>
        {graphSeverities.map((severity) => (
          <View key={severity} style={styles.severity}>
            <View style={[styles.swatch, { backgroundColor: severityColors[severity] }]} />
            <Text style={[ui.muted, styles.legendText]}>
              <Text style={{ color: workspace.text, fontFamily: FONT_FAMILY.semibold }}>{number.format(data.bySeverity[severity])}</Text>
              {" " + severityLabels[severity]}
            </Text>
          </View>
        ))}
      </View>
    </View>
  </View>;
}

export function ProjectStagesChart({ counts, total }: { counts: ProjectCounts; total: number }) {
  const { colors, ui, workspace } = useAppTheme();
  const { width, fontScale } = useWindowDimensions();
  if (!total) return <Text style={ui.body}>Nenhum projeto cadastrado.</Text>;
  const stacked = width < 320 || fontScale > 1.25;

  const stages = [
    { label: "Pendentes", count: counts.PENDING, color: colors.warningInk },
    { label: "Em andamento", count: counts.IN_PROGRESS, color: colors.chartCreated },
    { label: "Em revisão", count: counts.IN_REVIEW, color: colors.assistantInk },
    { label: "Concluídos", count: counts.COMPLETED, color: colors.chartResolved },
  ];

  return <View style={styles.stages}>
    {stages.map(({ label, count, color }) => (
      <View key={label} style={[styles.stage, stacked && styles.stageStacked]}>
        <View style={styles.stageLabel}>
          <Text style={[ui.muted, ui.grow]}>{label}</Text>
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
  findings: { flexDirection: "row", alignItems: "center", gap: 16, padding: 16, borderWidth: 1, borderRadius: 18 },
  findingsStacked: { flexDirection: "column", alignItems: "stretch" },
  findingsTotal: { minWidth: 56, flexShrink: 1 },
  total: { fontFamily: FONT_FAMILY.semibold, fontSize: 38, lineHeight: 43, letterSpacing: -1, fontVariant: ["tabular-nums"] },
  findingsDistribution: { flex: 1, minWidth: 0, gap: 9 },
  findingsDistributionStacked: { flex: 0 },
  distribution: { flexDirection: "row", height: 10, borderRadius: 5, overflow: "hidden" },
  severities: { flexDirection: "row", flexWrap: "wrap", rowGap: 4 },
  severity: { flexDirection: "row", alignItems: "center", gap: 6, width: "50%", paddingRight: 4 },
  swatch: { width: 8, height: 8, borderRadius: 4 },
  legendText: { flexShrink: 1 },
  stages: { flexDirection: "row", flexWrap: "wrap", columnGap: 18, rowGap: 14 },
  stage: { flexBasis: "45%", flexGrow: 1, gap: 5 },
  stageStacked: { flexBasis: "100%" },
  stageLabel: { flexDirection: "row", alignItems: "center", gap: 6 },
  stageCount: { fontFamily: FONT_FAMILY.semibold, fontVariant: ["tabular-nums"] },
  stageTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
  stageFill: { height: "100%", borderRadius: 3 },
});
