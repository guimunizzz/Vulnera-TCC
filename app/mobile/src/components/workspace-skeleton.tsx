/**
 * Placeholders próximos ao conteúdo real enquanto a API carrega.
 * Uma variação mínima de opacidade por grupo evita animar cada linha/SVG.
 * Consumidores: Home, detalhes, evidências e comentários; sem dados fictícios.
 */
import { useEffect } from "react";
import { StyleSheet, Text, View, type DimensionValue } from "react-native";
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { useWorkspaceMotionActive } from "./workspace-motion";
import { WORKSPACE, workspaceStyles as ui } from "../theme/workspace";

function SkeletonLine({ width = "100%", height = 14 }: { width?: DimensionValue; height?: number }) {
  return <View style={[styles.line, { width, height }]} />;
}

export function WorkspaceSkeleton({ kind, label }: { kind: "metrics" | "projects" | "project" | "finding" | "findings" | "evidence" | "comments"; label: string }) {
  const active = useWorkspaceMotionActive();
  const phase = useSharedValue(0);
  useEffect(() => {
    if (active) phase.value = withRepeat(withTiming(1, { duration: 1700 }), -1, true);
    else { cancelAnimation(phase); phase.value = 0; }
    return () => cancelAnimation(phase);
  }, [active, phase]);
  const glow = useAnimatedStyle(() => ({ opacity: active ? 0.94 + phase.value * 0.06 : 1 }));
  const line = (width: DimensionValue = "100%", height = 14) => <SkeletonLine width={width} height={height} />;
  const card = (key: number, tall = false) => <View key={key} style={styles.card}>
    <View style={styles.row}>{line(32, 32)}{line("35%")}</View>{line("84%", 22)}{line("64%")}{tall && <>{line("92%")}{line("75%")}</>}
  </View>;
  return <View accessible accessibilityRole="progressbar" accessibilityLabel={label} accessibilityState={{ busy: true }} aria-busy testID={`skeleton-${kind}`} style={styles.group}>
    {kind !== "metrics" && <Text style={ui.muted}>{label}</Text>}
    <Animated.View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.group, glow]}>
      {kind === "metrics" ? <View style={[styles.card, styles.metrics]}><View style={styles.metric}>{line(32, 26)}{line("90%")}</View><View style={styles.metric}>{line(32, 26)}{line("90%")}</View></View>
        : kind === "project" || kind === "finding" ? <>{line("88%", 34)}{line("67%")}{card(0, true)}{card(1, true)}</>
        : kind === "evidence" ? <View style={styles.card}>{line("100%", 180)}{line("70%")}</View>
        : <>{card(0)}{card(1)}</>}
    </Animated.View>
  </View>;
}
const styles = StyleSheet.create({
  group: { gap: 16 }, line: { borderRadius: 8, backgroundColor: WORKSPACE.neutralTint, overflow: "hidden" },
  card: { padding: 18, gap: 16, borderRadius: 24, borderWidth: 1, borderColor: WORKSPACE.line, backgroundColor: WORKSPACE.glass },
  row: { flexDirection: "row", alignItems: "center", gap: 12 }, metrics: { flexDirection: "row", minHeight: 92, padding: 16, gap: 16 }, metric: { flex: 1, gap: 6 },
});
