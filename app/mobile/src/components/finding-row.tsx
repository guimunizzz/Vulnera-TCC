import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import type { IconAvatarTone } from "./icon-avatar";
import { IconAvatar } from "./icon-avatar";
import { Card } from "./card";
import { ROTULO_ESTADO, ROTULO_SEVERIDADE, SeverityBadge, StatusBadge } from "./badge";
import { COLORS, FONT_FAMILY, FONT_SIZE, SPACING } from "../theme/tokens";
import type { Vulnerability } from "../types/vulnerability.types";

// Tom do avatar acompanha a severidade — mesma pista visual do SeverityBadge,
// só que reforçada no ícone que abre a linha (varredura mais rápida da lista).
const SEVERITY_TONES: Record<string, IconAvatarTone> = {
  CRITICAL: "critical",
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
  NONE: "neutral",
};

export function FindingRow({
  finding,
  onPress,
  index = 0,
}: {
  finding: Vulnerability;
  onPress: () => void;
  /** Posição na lista — escalona a entrada de cada linha (cascata em vez de tudo aparecendo junto). */
  index?: number;
}) {
  const severityLabel = (ROTULO_SEVERIDADE[finding.severityFinal as keyof typeof ROTULO_SEVERIDADE] ?? finding.severityFinal).toLowerCase();
  const statusLabel = (ROTULO_ESTADO[finding.status]?.texto ?? finding.status).toLowerCase();

  return (
    <Animated.View entering={FadeInDown.duration(320).delay(Math.min(index, 8) * 45)}>
      <Card
        onPress={onPress}
        style={styles.row}
        accessibilityLabel={`${finding.title}, severidade ${severityLabel}, status ${statusLabel}`}
      >
        <IconAvatar name="bug-outline" tone={SEVERITY_TONES[finding.severityFinal] ?? "neutral"} />
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
    gap: SPACING[2],
  },
  title: {
    fontSize: FONT_SIZE.sm,
    fontFamily: FONT_FAMILY.semibold,
    color: COLORS.textPrimary,
  },
  badges: {
    flexDirection: "row",
    gap: SPACING[2],
  },
});
