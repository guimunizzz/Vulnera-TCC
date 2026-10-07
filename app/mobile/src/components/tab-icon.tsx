/**
 * tab-icon.tsx
 *
 * Ícone de aba com uma "pill" de fundo que aparece/cresce quando a aba fica
 * ativa (Reanimated), em vez de só trocar a cor do ícone — mesma linguagem
 * visual do resto do app (destaque = fundo colorido, não só tom de texto).
 */

import { useEffect } from "react";
import { StyleSheet, View, type ColorValue } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { COLORS, RADIUS } from "../theme/tokens";
import { SOFT_MOTION, useWorkspaceReducedMotion } from "./workspace-motion";

export function TabIcon({
  name,
  focused,
  color,
  size,
}: {
  name: keyof typeof Ionicons.glyphMap;
  focused: boolean;
  color: ColorValue;
  size: number;
}) {
  const progress = useSharedValue(focused ? 1 : 0);
  const reduced = useWorkspaceReducedMotion();

  useEffect(() => {
    progress.value = withTiming(focused ? 1 : 0, { ...SOFT_MOTION, duration: reduced ? 0 : 220 });
  }, [focused, progress, reduced]);

  const pillStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: reduced ? 1 : 0.92 + progress.value * 0.08 }],
  }));

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.pill, pillStyle]} />
      <Ionicons name={name} color={color} size={size} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 48,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  pill: {
    position: "absolute",
    width: 48,
    height: 32,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.accentSurface,
  },
});
