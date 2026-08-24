/**
 * tab-icon.tsx
 *
 * Ícone de aba com uma "pill" de fundo que aparece/cresce quando a aba fica
 * ativa (Reanimated), em vez de só trocar a cor do ícone — mesma linguagem
 * visual do resto do app (destaque = fundo colorido, não só tom de texto).
 */

import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { COLORS, RADIUS } from "../theme/tokens";

export function TabIcon({
  name,
  focused,
  color,
  size,
}: {
  name: keyof typeof Ionicons.glyphMap;
  focused: boolean;
  color: string;
  size: number;
}) {
  const progress = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    progress.value = withSpring(focused ? 1 : 0, { damping: 14, stiffness: 180 });
  }, [focused, progress]);

  const pillStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.7 + progress.value * 0.3 }],
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
