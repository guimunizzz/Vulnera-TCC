import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Card } from "./card";
import { SeverityBadge, StatusBadge } from "./badge";
import { COLORS, FONT_SIZE, FONT_WEIGHT, SPACING } from "../theme/tokens";
import type { Vulnerability } from "../types/vulnerability.types";

const SEVERITY_LABELS: Record<string, string> = {
  CRITICAL: "crítica",
  HIGH: "alta",
  MEDIUM: "média",
  LOW: "baixa",
  NONE: "informativa",
};
const STATUS_LABELS: Record<string, string> = {
  OPEN: "aberto",
  IN_PROGRESS: "em andamento",
  FIXED: "corrigido",
  CLOSED: "fechado",
};

export function FindingRow({ finding, onPress }: { finding: Vulnerability; onPress: () => void }) {
  const severityLabel = SEVERITY_LABELS[finding.severityFinal] ?? finding.severityFinal;
  const statusLabel = STATUS_LABELS[finding.status] ?? finding.status;

  return (
    <Card
      onPress={onPress}
      style={styles.row}
      accessibilityLabel={`${finding.title}, severidade ${severityLabel}, status ${statusLabel}`}
    >
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>
          {finding.title}
        </Text>
        <View style={styles.badges}>
          <SeverityBadge severidade={finding.severityFinal} />
          <StatusBadge status={finding.status} />
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  info: {
    flex: 1,
    gap: SPACING[2],
  },
  title: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textPrimary,
  },
  badges: {
    flexDirection: "row",
    gap: SPACING[2],
  },
});
