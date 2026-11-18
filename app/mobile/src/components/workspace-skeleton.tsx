/**
 * Placeholders próximos ao conteúdo real enquanto a API carrega.
 * Uma variação mínima de opacidade por grupo evita animar cada linha/SVG.
 * Consumidores: Home, Relatórios, detalhes, evidências e comentários.
 */
import { useEffect } from "react";
import { StyleSheet, Text, View, type DimensionValue } from "react-native";
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { useWorkspaceMotionActive } from "./workspace-motion";
import { useAppTheme } from "../theme/use-app-theme";

function SkeletonLine({ width = "100%", height = 14, tint }: { width?: DimensionValue; height?: number; tint: string }) {
  return <View style={[styles.line, { width, height, backgroundColor: tint }]} />;
}

export function WorkspaceSkeleton({ kind, label }: { kind: "metrics" | "projects" | "project" | "finding" | "findings" | "evidence" | "comments"; label: string }) {
  const { workspace, ui } = useAppTheme();
  const active = useWorkspaceMotionActive();
  const phase = useSharedValue(0);
  useEffect(() => {
    if (active) phase.value = withRepeat(withTiming(1, { duration: 1700 }), -1, true);
    else { cancelAnimation(phase); phase.value = 0; }
    return () => cancelAnimation(phase);
  }, [active, phase]);
  const glow = useAnimatedStyle(() => ({ opacity: active ? 0.92 + phase.value * 0.08 : 1 }));
  const line = (width: DimensionValue = "100%", height = 14) => <SkeletonLine width={width} height={height} tint={workspace.neutralTint} />;
  const card = (key: number, tall = false) => <View key={key} style={[styles.card, { borderColor: workspace.line, backgroundColor: workspace.glass }]}>
    <View style={styles.row}>{line(32, 32)}{line("35%")}</View>{line("84%", 22)}{line("64%")}{tall && <>{line("92%")}{line("75%")}</>}
  </View>;
  return <View accessible accessibilityRole="progressbar" accessibilityLabel={label} accessibilityState={{ busy: true }} aria-busy testID={`skeleton-${kind}`} style={styles.group}>
    {kind !== "metrics" && <Text style={ui.muted}>{label}</Text>}
    <Animated.View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.group, glow]}>
      {kind === "metrics" ? <View style={[styles.card, styles.metrics, { borderColor: workspace.line, backgroundColor: workspace.glass }]}><View style={styles.metric}>{line(32, 26)}{line("90%")}</View><View style={styles.metric}>{line(32, 26)}{line("90%")}</View></View>
        : kind === "project" || kind === "finding" ? <>{line("88%", 34)}{line("67%")}{card(0, true)}{card(1, true)}</>
        : kind === "evidence" ? <View style={[styles.card, { borderColor: workspace.line, backgroundColor: workspace.glass }]}>{line("100%", 180)}{line("70%")}</View>
        : <>{card(0)}{card(1)}</>}
    </Animated.View>
  </View>;
}
const styles = StyleSheet.create({
  group: { gap: 16 }, line: { borderRadius: 8, overflow: "hidden" },
  card: { padding: 18, gap: 16, borderRadius: 24, borderWidth: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 }, metrics: { flexDirection: "row", minHeight: 92, padding: 16, gap: 16 }, metric: { flex: 1, gap: 6 },
});
