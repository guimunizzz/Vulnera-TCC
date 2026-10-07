/**
 * Cartão de vulnerabilidade com severidade, CVSS, SLA e VRS reais da listagem.
 * Facilita a leitura do projeto sem acrescentar ações de remediação no mobile.
 * Consumidor: lista paginada do detalhe de projeto.
 */
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { GlassSurface } from "./workspace-ui";
import { ROTULO_SEVERIDADE, SeverityBadge, StatusBadge } from "./badge";
import { FONT_FAMILY } from "../theme/tokens";
import { WORKSPACE, workspaceStyles as ui } from "../theme/workspace";
import { fraseDoSla, VRS_BAND_LABELS, type VulnerabilityListItem } from "../types/vulnerability.types";

export function FindingRow({ finding, onPress }: { finding: VulnerabilityListItem; onPress: () => void }) {
  const severity = ROTULO_SEVERIDADE[finding.severityFinal as keyof typeof ROTULO_SEVERIDADE] ?? finding.severityFinal;
  return <GlassSurface onPress={onPress} accessibilityLabel={`${finding.title}, severidade ${severity}. Abrir detalhe.`} style={styles.card}>
    <View style={[ui.spread, { flexWrap: "wrap" }]}><SeverityBadge severidade={finding.severityFinal} cvss={finding.cvssScore} /><StatusBadge status={finding.status} /></View>
    <Text numberOfLines={3} style={styles.title}>{finding.title}</Text>
    <View style={ui.spread}><Text style={ui.mono}>OWASP / {finding.owaspCategory}</Text><Ionicons name="arrow-forward" size={18} color={WORKSPACE.lavender} /></View>
    {(finding.slaState !== "NO_SLA" || finding.vrsScore != null || finding.hasActiveRiskAcceptance) && <View style={styles.context}>
      {finding.slaState !== "NO_SLA" && <Text style={[ui.muted, finding.slaState === "BREACHED" && styles.danger]}>Prazo · {fraseDoSla(finding.slaState, finding.slaRemainingMs)}</Text>}
      {finding.vrsScore != null && finding.vrsBand && <Text style={ui.muted}>Prioridade · {finding.vrsScore}/100 · {VRS_BAND_LABELS[finding.vrsBand]}</Text>}
      {finding.hasActiveRiskAcceptance && <Text style={ui.muted}>Aceite de risco vigente</Text>}
      {finding.assigneeName && <Text style={ui.muted}>Responsável · {finding.assigneeName}</Text>}
    </View>}
  </GlassSurface>;
}
const styles = StyleSheet.create({
  card: { gap: 12, padding: 18 }, title: { fontFamily: FONT_FAMILY.medium, fontSize: 17, lineHeight: 25, letterSpacing: -0.2, color: WORKSPACE.text },
  context: { borderTopWidth: 1, borderTopColor: WORKSPACE.line, paddingTop: 12, gap: 4 }, danger: { color: "#fda4af" },
});
