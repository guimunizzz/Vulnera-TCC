import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Card } from "./card";
import { StatusBadge } from "./badge";
import { COLORS, FONT_SIZE, FONT_WEIGHT, SPACING } from "../theme/tokens";
import type { Project } from "../types/project.types";

const ANALYSIS_LABELS: Record<string, string> = { SAST: "SAST", DAST: "DAST", MATURITY: "Maturidade", COMBO: "Combinada" };
const STATUS_LABELS: Record<string, string> = {
  PENDING: "pendente",
  IN_PROGRESS: "em andamento",
  IN_REVIEW: "em revisão",
  COMPLETED: "concluído",
};

export function ProjectCard({ project, onPress }: { project: Project; onPress: () => void }) {
  const analysisLabel = ANALYSIS_LABELS[project.analysisType] ?? project.analysisType;
  const statusLabel = STATUS_LABELS[project.status] ?? project.status;

  return (
    <Card
      onPress={onPress}
      style={styles.row}
      accessibilityLabel={`${project.name}, análise ${analysisLabel}, status ${statusLabel}`}
    >
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>
          {project.name}
        </Text>
        <Text style={styles.subtitle}>{analysisLabel}</Text>
        <StatusBadge status={project.status} />
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
    gap: SPACING[1],
  },
  title: {
    fontSize: FONT_SIZE.base,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textPrimary,
  },
  subtitle: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
  },
});
