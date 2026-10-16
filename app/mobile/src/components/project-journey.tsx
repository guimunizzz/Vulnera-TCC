/**
 * Jornada da análise com luz que percorre apenas as etapas já alcançadas.
 * Explica o progresso real ao abrir o projeto, sem sugerir avanço da análise.
 * Consumidor: detalhe de projeto no mobile; respeita foco e movimento reduzido.
 */
import { useCallback, useId, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming, type SharedValue } from "react-native-reanimated";
import Svg, { Defs, Ellipse, RadialGradient, Stop } from "react-native-svg";
import { COLORS, FONT_FAMILY } from "../theme/tokens";
import { WORKSPACE } from "../theme/workspace";
import { SOFT_MOTION, useWorkspaceReducedMotion } from "./workspace-motion";

const STAGES = [
  { status: "PENDING", label: "Solicitado" },
  { status: "IN_PROGRESS", label: "Em análise" },
  { status: "IN_REVIEW", label: "Revisão" },
  { status: "COMPLETED", label: "Concluído" },
];
const JOURNEY_DURATION = 800;
const LIGHT_WIDTH = 96;

export function ProjectJourney({ status }: { status: string }) {
  const stage = STAGES.findIndex((item) => item.status === status);
  const completed = status === "COMPLETED";
  const reduced = useWorkspaceReducedMotion();
  const [width, setWidth] = useState(0);
  const progress = useSharedValue(stage);
  const lightOpacity = useSharedValue(0);
  const pulse = useSharedValue(0);
  const gradientId = `journey-light-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const cellWidth = width / STAGES.length;

  // O foco dispara uma vez por abertura; refetch/paginação não refazem a viagem.
  // A posição usa etapas, permitindo redimensionar sem reiniciar a animação.
  useFocusEffect(useCallback(() => {
    progress.value = reduced ? stage : 0;
    lightOpacity.value = 0;
    pulse.value = 0;
    if (!reduced && stage >= 0) {
      progress.value = withTiming(stage, { duration: JOURNEY_DURATION, easing: Easing.inOut(Easing.cubic) });
      lightOpacity.value = withSequence(
        withTiming(1, { duration: 100 }),
        withDelay(JOURNEY_DURATION - 200, withTiming(0, { duration: 100 })),
      );
      pulse.value = withDelay(JOURNEY_DURATION, withSequence(
        withTiming(1, { ...SOFT_MOTION, duration: 160 }),
        withTiming(0, { ...SOFT_MOTION, duration: 240 }),
      ));
    }
    return () => {
      cancelAnimation(progress); cancelAnimation(lightOpacity); cancelAnimation(pulse);
      progress.value = stage; lightOpacity.value = 0; pulse.value = 0;
    };
  }, [stage, reduced, progress, lightOpacity, pulse]));

  const trail = useAnimatedStyle(() => ({
    width: Math.max(0, progress.value) * cellWidth,
  }));
  const light = useAnimatedStyle(() => ({
    opacity: reduced || width === 0 || stage < 0 ? 0 : lightOpacity.value,
    transform: [{ translateX: Math.max(0, progress.value) * cellWidth }],
  }));

  return <View testID="project-journey" style={styles.timeline}
    onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.rail} />
    <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={[styles.trail, completed && styles.completedTrail, trail]} />
    <Animated.View testID="journey-light-sweep" pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={[styles.light, { left: cellWidth / 2 - LIGHT_WIDTH / 2 }, light]}>
      <Svg width={LIGHT_WIDTH} height={48} viewBox={`0 0 ${LIGHT_WIDTH} 48`}>
        <Defs><RadialGradient id={gradientId}>
          <Stop offset="0" stopColor="#c4a2ff" stopOpacity="0.58" />
          <Stop offset="0.4" stopColor="#a47beb" stopOpacity="0.34" />
          <Stop offset="1" stopColor="#8b5cf6" stopOpacity="0" />
        </RadialGradient></Defs>
        <Ellipse cx={LIGHT_WIDTH / 2} cy={24} rx={LIGHT_WIDTH / 2} ry={20} fill={`url(#${gradientId})`} />
      </Svg>
    </Animated.View>
    {STAGES.map((item, index) => <JourneyStage key={item.status} index={index} label={item.label}
      stage={stage} completed={completed} progress={progress} lightOpacity={lightOpacity} pulse={pulse} reduced={reduced} />)}
  </View>;
}

function JourneyStage({ index, label, stage, completed, progress, lightOpacity, pulse, reduced }: {
  index: number; label: string; stage: number; completed: boolean; reduced: boolean;
  progress: SharedValue<number>; lightOpacity: SharedValue<number>; pulse: SharedValue<number>;
}) {
  const current = index === stage;
  const reached = index <= stage;
  const color = current ? (completed ? COLORS.successInk : COLORS.severity.lowInk) : WORKSPACE.lavender;
  const dot = useAnimatedStyle(() => ({
    transform: [{ scale: current && !reduced ? 1 + pulse.value * 0.12 : 1 }],
  }));
  const illumination = useAnimatedStyle(() => {
    const passed = reached && progress.value >= index;
    const nearby = reached ? Math.max(0, 1 - Math.abs(progress.value - index) * 2) : 0;
    return { opacity: (passed ? 0.24 : 0) + (reduced ? 0 : nearby * lightOpacity.value * 0.65) };
  });
  const halo = useAnimatedStyle(() => ({
    opacity: current && !reduced ? pulse.value * 0.55 : 0,
    transform: [{ scale: 1 + pulse.value * 0.2 }],
  }));
  return <View style={styles.stage} accessible
    accessibilityLabel={`${label}: ${current && !completed ? "etapa atual" : reached ? "concluída" : "ainda não iniciada"}`}>
    <Animated.View style={[styles.stageDot, reached && styles.stageDone, current && styles.stageCurrent,
      current && completed && styles.stageCompleted, dot]}>
      <Animated.View pointerEvents="none" style={[styles.halo, { borderColor: color }, halo]} />
      <Animated.View pointerEvents="none" style={[styles.illumination, { borderColor: color }, illumination]} />
      <Text style={[styles.stageNumber, reached && { color: WORKSPACE.text }]}>{index + 1}</Text>
    </Animated.View>
    <Text style={[styles.stageLabel, current && { color }]}>{label}</Text>
  </View>;
}

const styles = StyleSheet.create({
  timeline: { flexDirection: "row", marginHorizontal: -8 },
  rail: { position: "absolute", left: "12.5%", right: "12.5%", top: 13.5, height: 1, backgroundColor: WORKSPACE.line },
  trail: { position: "absolute", left: "12.5%", top: 13, height: 2, backgroundColor: "rgba(196,162,255,0.55)" },
  completedTrail: { backgroundColor: COLORS.successInk },
  light: { position: "absolute", top: -10, width: LIGHT_WIDTH, height: 48 },
  stage: { flex: 1, alignItems: "center", gap: 9 },
  stageDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: WORKSPACE.inset,
    borderWidth: 1, borderColor: WORKSPACE.line, alignItems: "center", justifyContent: "center" },
  stageDone: { backgroundColor: "#34383e", borderColor: "rgba(255,255,255,0.2)" },
  stageCurrent: { backgroundColor: COLORS.severity.lowSurface, borderColor: COLORS.severity.lowInk },
  stageCompleted: { backgroundColor: COLORS.successSurface, borderColor: COLORS.successInk },
  illumination: { ...StyleSheet.absoluteFill, borderRadius: 14, borderWidth: 1, backgroundColor: "rgba(196,162,255,0.2)" },
  halo: { position: "absolute", top: -6, bottom: -6, left: -6, right: -6, borderRadius: 20, borderWidth: 1 },
  stageNumber: { fontSize: 12, fontFamily: FONT_FAMILY.medium, color: WORKSPACE.muted },
  stageLabel: { fontSize: 12, color: WORKSPACE.muted, fontFamily: FONT_FAMILY.medium, textAlign: "center" },
});
