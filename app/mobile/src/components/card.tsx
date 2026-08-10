import type { ReactNode } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { COLORS, RADIUS, SPACING } from "../theme/tokens";

/** Superfície elevada — mesmo papel do <Card> web (bg-surface + borda + raio de container). */
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
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => [styles.card, style, pressed && styles.pressed]}
        // 44px mínimo de alvo de toque mesmo quando o card é mais baixo que isso
        hitSlop={4}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.container,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    padding: SPACING[4],
    gap: SPACING[2],
  },
  pressed: {
    backgroundColor: COLORS.raised,
  },
});
