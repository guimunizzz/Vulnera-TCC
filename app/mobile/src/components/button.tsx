import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { COLORS, FONT_FAMILY, FONT_SIZE, MOTION, RADIUS, SHADOW, SPACING, TOUCH_TARGET } from "../theme/tokens";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Variant = "primario" | "secundario" | "perigo";

const VARIANTES: Record<Variant, { fundo: string; texto: string; borda?: string }> = {
  primario: { fundo: COLORS.accent, texto: COLORS.accentFg },
  secundario: { fundo: "transparent", texto: COLORS.textPrimary, borda: COLORS.borderDefault },
  perigo: { fundo: "transparent", texto: COLORS.dangerInk, borda: COLORS.danger },
};

/** Botão com alvo de toque garantido em 44px (WCAG 2.5.5/2.5.8 — mesmo mínimo do web). CTA primário ganha um brilho sutil na cor do acento; escala anima no toque em todas as variantes. */
export function Button({
  children,
  onPress,
  variant = "primario",
  disabled,
  loading,
}: {
  children: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
}) {
  const cor = VARIANTES[variant];
  const inativo = disabled || loading;
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const conteudo = loading ? (
    <ActivityIndicator color={cor.texto} size="small" />
  ) : (
    <Text style={[styles.texto, { color: cor.texto }]}>{children}</Text>
  );

  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={inativo}
      accessibilityRole="button"
      accessibilityState={{ disabled: inativo, busy: loading }}
      onPressIn={() => {
        scale.value = withTiming(0.96, { duration: MOTION.fast });
      }}
      onPressOut={() => {
        scale.value = withTiming(1, { duration: MOTION.fast });
      }}
      style={[
        styles.base,
        { backgroundColor: cor.fundo, borderColor: cor.borda ?? "transparent" },
        variant === "primario" && SHADOW.glow,
        inativo && styles.disabled,
        animatedStyle,
      ]}
    >
      {conteudo}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    // Pill (RADIUS.full já é o token semântico pra esse formato — avatar/pill)
    // em vez do control padrão: CTA mais "de produto", ao estilo do botão
    // grande do Mercado Livre, sem inventar valor de raio novo.
    minHeight: TOUCH_TARGET,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    paddingHorizontal: SPACING[6],
    alignItems: "center",
    justifyContent: "center",
  },
  texto: {
    fontSize: FONT_SIZE.sm,
    fontFamily: FONT_FAMILY.semibold,
  },
  disabled: {
    opacity: 0.5,
  },
});
