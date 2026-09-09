import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { COLORS, MOTION, RADIUS, SHADOW, SPACING } from "../theme/tokens";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Superfície elevada — mesmo papel do <Card> web (bg-surface + borda + raio de container), com feedback de toque animado (escala + fundo). */
export function Card({
  children,
  onPress,
  style,
  accessibilityLabel,
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  /** Lido pelo leitor de tela como uma frase só, em vez de cada Text filho separado — útil em cards que são um item de lista tocável. */
  accessibilityLabel?: string;
}) {
  const scale = useSharedValue(1);
  const [pressed, setPressed] = useState(false);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  if (onPress) {
    return (
      <AnimatedPressable
        onPress={onPress}
        onPressIn={() => {
          scale.value = withTiming(0.97, { duration: MOTION.fast });
          setPressed(true);
        }}
        onPressOut={() => {
          scale.value = withTiming(1, { duration: MOTION.fast });
          setPressed(false);
        }}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={[styles.card, style, pressed && styles.pressed, animatedStyle]}
        // 44px mínimo de alvo de toque mesmo quando o card é mais baixo que isso
        hitSlop={4}
      >
        {children}
      </AnimatedPressable>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    // Sem borda de propósito — a hierarquia vem do tom (canvas→surface, bem
    // próximos) e da sombra, não de um contorno. Borda + sombra + salto de
    // cor grande deixava o card parecendo uma caixa flutuando isolada.
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.container,
    padding: SPACING[4],
    gap: SPACING[2],
    ...SHADOW.card,
  },
  pressed: {
    backgroundColor: COLORS.raised,
  },
});
