/**
 * Expansão de informações e comentários sem saltos de altura.
 * Mede o conteúdo real para acompanhar fonte maior, novas páginas e texto da API.
 * Consumidores: detalhes de projeto/vulnerabilidade; não dispara consultas próprias.
 */
import { useEffect, useState, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { GlassSurface } from "./workspace-ui";
import { SOFT_MOTION, SoftPressable, useWorkspaceReducedMotion } from "./workspace-motion";
import { WORKSPACE, workspaceStyles as ui } from "../theme/workspace";

export function WorkspaceDisclosure({ title, children, initiallyExpanded = true, surface = true }: {
  title: string; children: ReactNode; initiallyExpanded?: boolean; surface?: boolean;
}) {
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const [interacted, setInteracted] = useState(false);
  const [measuredHeight, setMeasuredHeight] = useState(0);
  const reduced = useWorkspaceReducedMotion();
  const height = useSharedValue(0);
  const progress = useSharedValue(expanded ? 1 : 0);
  useEffect(() => {
    const config = { ...SOFT_MOTION, duration: reduced ? 0 : 260 };
    // A primeira renderização usa a altura natural: não cresce durante a navegação.
    height.value = interacted ? withTiming(expanded ? measuredHeight : 0, config) : expanded ? measuredHeight : 0;
    progress.value = interacted ? withTiming(expanded ? 1 : 0, config) : expanded ? 1 : 0;
    return () => { cancelAnimation(height); cancelAnimation(progress); };
  }, [expanded, interacted, measuredHeight, reduced, height, progress]);
  const body = useAnimatedStyle(() => ({ height: !interacted && expanded ? undefined : height.value, opacity: progress.value }));
  const arrow = useAnimatedStyle(() => ({ transform: [{ rotate: `${progress.value * 180}deg` }] }));
  const content = <>
    <SoftPressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ expanded }} aria-expanded={expanded}
      onPress={() => { setInteracted(true); setExpanded((value) => !value); }} style={[styles.toggle, !surface && styles.inlineToggle]}>
      <Text style={[ui.eyebrow, styles.title]}>{title}</Text>
      <Animated.View style={arrow}><Ionicons name="chevron-down" size={18} color={WORKSPACE.muted} /></Animated.View>
    </SoftPressable>
    <Animated.View testID={`disclosure-${title}`} pointerEvents={expanded ? "auto" : "none"} accessibilityElementsHidden={!expanded}
      importantForAccessibility={expanded ? "auto" : "no-hide-descendants"} aria-hidden={!expanded} style={[styles.body, body]}>
      <View onLayout={(event) => { const next = event.nativeEvent.layout.height; setMeasuredHeight((previous) => Math.abs(previous - next) > 0.5 ? next : previous); }} style={[styles.measure, !interacted && expanded && styles.naturalHeight, surface ? styles.surfaceBody : styles.inlineBody]}>
        {children}
      </View>
    </Animated.View>
  </>;
  return surface ? <GlassSurface style={styles.surface}>{content}</GlassSurface> : <View>{content}</View>;
}
const styles = StyleSheet.create({
  surface: { padding: 0, gap: 0 }, toggle: { minHeight: 56, paddingHorizontal: 20, paddingVertical: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  inlineToggle: { paddingHorizontal: 0, paddingVertical: 10, minHeight: 48 }, title: { flex: 1 },
  body: { overflow: "hidden" }, measure: { position: "absolute", left: 0, right: 0, top: 0, gap: 12 },
  naturalHeight: { position: "relative" },
  surfaceBody: { paddingHorizontal: 20, paddingBottom: 20 }, inlineBody: { paddingBottom: 4 },
});
