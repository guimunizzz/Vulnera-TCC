import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import type { IoniconsGlyph } from "./icon-avatar";
import { IconAvatar } from "./icon-avatar";
import { Card } from "./card";
import { ROTULO_ESTADO, StatusBadge } from "./badge";
import { COLORS, FONT_FAMILY, FONT_SIZE, SPACING } from "../theme/tokens";
import type { Project } from "../types/project.types";

const ANALYSIS_LABELS: Record<string, string> = { SAST: "SAST", DAST: "DAST", MATURITY: "Maturidade", COMBO: "Combinada" };
// Ícone por tipo de análise — mesma lógica de "categoria com ícone" das
// listas do Mercado Livre, adaptada pro vocabulário do produto.
const ANALYSIS_ICONS: Record<string, IoniconsGlyph> = {
  SAST: "code-slash-outline",
  DAST: "globe-outline",
  MATURITY: "shield-checkmark-outline",
  COMBO: "layers-outline",
};

export function ProjectCard({
  project,
  onPress,
  index = 0,
}: {
  project: Project;
  onPress: () => void;
  /** Posição na lista — escalona a entrada de cada card (cascata em vez de tudo aparecendo junto). */
  index?: number;
}) {
  const analysisLabel = ANALYSIS_LABELS[project.analysisType] ?? project.analysisType;
  const statusLabel = (ROTULO_ESTADO[project.status]?.texto ?? project.status).toLowerCase();

  return (
    <Animated.View entering={FadeInDown.duration(320).delay(Math.min(index, 8) * 45)}>
      <Card
        onPress={onPress}
        style={styles.row}
        accessibilityLabel={`${project.name}, análise ${analysisLabel}, status ${statusLabel}`}
      >
        <IconAvatar name={ANALYSIS_ICONS[project.analysisType] ?? "folder-outline"} tone="neutral" />
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>
            {project.name}
          </Text>
          <Text style={styles.subtitle}>{analysisLabel}</Text>
          <StatusBadge status={project.status} />
        </View>
        <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
      </Card>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING[3],
  },
  info: {
    flex: 1,
    gap: SPACING[1],
  },
  title: {
    fontSize: FONT_SIZE.base,
    fontFamily: FONT_FAMILY.semibold,
    color: COLORS.textPrimary,
  },
  subtitle: {
    fontSize: FONT_SIZE.xs,
    fontFamily: FONT_FAMILY.regular,
    color: COLORS.textMuted,
  },
});
