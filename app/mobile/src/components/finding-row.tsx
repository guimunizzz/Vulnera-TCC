/**
 * Cartão de vulnerabilidade com severidade, CVSS, SLA e VRS reais da listagem.
 * Facilita a leitura do projeto sem acrescentar ações de remediação no mobile.
 * Consumidor: lista paginada do detalhe de projeto e Top riscos do relatório.
 */
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Surface } from "./workspace-ui";
import { ROTULO_SEVERIDADE, SeverityBadge, StatusBadge } from "./badge";
import { FONT_FAMILY } from "../theme/tokens";
import { getSlaInk, useAppTheme } from "../theme/use-app-theme";
import { fraseDoSla, VRS_BAND_LABELS, type VulnerabilityListItem } from "../types/vulnerability.types";

export function FindingRow({ finding, onPress }: { finding: VulnerabilityListItem; onPress: () => void }) {
  const { colors, workspace, ui } = useAppTheme();
  const severity = ROTULO_SEVERIDADE[finding.severityFinal as keyof typeof ROTULO_SEVERIDADE] ?? finding.severityFinal;
  const prazoInk = getSlaInk(finding.slaState, colors);
  return <Surface onPress={onPress} accessibilityLabel={`${finding.title}, severidade ${severity}. Abrir detalhe.`} style={styles.card}>
    <View style={[ui.spread, { flexWrap: "wrap" }]}><SeverityBadge severidade={finding.severityFinal} cvss={finding.cvssScore} /><StatusBadge status={finding.status} /></View>
    <Text numberOfLines={3} style={[styles.title, { color: workspace.text }]}>{finding.title}</Text>
    <View style={ui.spread}><Text style={ui.mono}>OWASP / {finding.owaspCategory}</Text><Ionicons name="arrow-forward" size={18} color={workspace.secondary} /></View>
    {(finding.slaState !== "NO_SLA" || finding.vrsScore != null || finding.hasActiveRiskAcceptance) && <View style={[styles.context, { borderTopColor: workspace.line }]}>
      {finding.slaState !== "NO_SLA" && <Text style={[ui.muted, prazoInk && { color: prazoInk }]}>Prazo · {fraseDoSla(finding.slaState, finding.slaRemainingMs)}</Text>}
      {finding.vrsScore != null && finding.vrsBand && <Text style={ui.muted}>Prioridade · {finding.vrsScore}/100 · {VRS_BAND_LABELS[finding.vrsBand]}</Text>}
      {finding.hasActiveRiskAcceptance && <Text style={ui.muted}>Aceite de risco vigente</Text>}
      {finding.assigneeName && <Text style={ui.muted}>Responsável · {finding.assigneeName}</Text>}
    </View>}
  </Surface>;
}
const styles = StyleSheet.create({
  card: { gap: 12, padding: 18 }, title: { fontFamily: FONT_FAMILY.medium, fontSize: 17, lineHeight: 25, letterSpacing: -0.2 },
  context: { borderTopWidth: 1, paddingTop: 12, gap: 4 },
});
