/**
 * Cartão do portfólio do cliente, com status e datas fornecidos pela API.
 * Dá contexto à navegação sem representar fases como percentual inventado.
 * Consumidor: Home autenticada do mobile.
 */
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { GlassSurface } from "./workspace-ui";
import { StatusBadge } from "./badge";
import { FONT_FAMILY } from "../theme/tokens";
import { WORKSPACE, workspaceStyles as ui } from "../theme/workspace";
import { displayDate } from "../lib/display";
import type { Project } from "../types/project.types";

export function ProjectCard({ project, onPress }: { project: Project; onPress: () => void }) {
  return <GlassSurface onPress={onPress} accessibilityLabel={`Abrir projeto ${project.name}`} style={styles.card}>
    <View style={ui.spread}><View style={ui.row}><View style={styles.icon}><Ionicons name={project.analysisType === "SAST" ? "code-slash-outline" : "scan-outline"} size={20} color={WORKSPACE.secondary} /></View>
      <Text style={ui.eyebrow}>{project.analysisType === "MATURITY" ? "MATURIDADE" : project.analysisType === "COMBO" ? "COMBINADA" : project.analysisType}</Text></View><StatusBadge status={project.status} /></View>
    <Text style={styles.name} numberOfLines={2}>{project.name}</Text>
    {!!project.description && <Text style={ui.muted} numberOfLines={2}>{project.description}</Text>}
    <View style={styles.footer}><View style={[ui.row, { gap: 6 }]}><Ionicons name="calendar-outline" size={13} color={WORKSPACE.muted} /><Text style={ui.muted}>Solicitado em {displayDate(project.requestedAt)}</Text></View>
      <View style={styles.arrow}><Ionicons name="chevron-forward" size={20} color={WORKSPACE.secondary} /></View></View>
  </GlassSurface>;
}
const styles = StyleSheet.create({
  card: { gap: 12, padding: 18 }, icon: { width: 32, height: 32, borderRadius: 12, backgroundColor: WORKSPACE.neutralTint, alignItems: "center", justifyContent: "center" },
  name: { fontFamily: FONT_FAMILY.medium, fontSize: 18, lineHeight: 26, color: WORKSPACE.text, letterSpacing: -0.2 },
  footer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8, borderTopWidth: 1, borderTopColor: WORKSPACE.line, paddingTop: 12 },
  arrow: { width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: WORKSPACE.neutralTint },
});
