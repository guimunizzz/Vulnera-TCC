import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { FONT_FAMILY, FONT_SIZE, MOTION, RADIUS, SHADOW, SPACING, TOUCH_TARGET } from "../theme/tokens";
import { useAppTheme, type AppColors } from "../theme/use-app-theme";
import { MotionReveal, SoftPressable, useWorkspaceReducedMotion } from "./workspace-motion";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Variant = "primario" | "secundario" | "perigo";

function getVariants(colors: AppColors): Record<Variant, { fundo: string; texto: string; borda?: string }> {
  return {
    primario: { fundo: colors.accent, texto: colors.accentFg },
    secundario: { fundo: "transparent", texto: colors.textPrimary, borda: colors.borderDefault },
    perigo: { fundo: "transparent", texto: colors.dangerInk, borda: colors.danger },
  };
}

/**
 * Botão com alvo de toque mínimo de 44px (`soft` eleva para 48px), compatível
 * com os temas escuro e claro.
 */
export function Button({
  children,
  onPress,
  variant = "primario",
  disabled,
  loading,
  soft = false,
}: {
  children: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  soft?: boolean;
}) {
  const { colors } = useAppTheme();
  const reduced = useWorkspaceReducedMotion();
  const cor = getVariants(colors)[variant];
  const inativo = disabled || loading;
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const pressHandlers = {
    onPressIn: () => {
      if (!reduced) scale.value = withTiming(0.96, { duration: MOTION.fast });
    },
    onPressOut: () => {
      scale.value = reduced ? 1 : withTiming(1, { duration: MOTION.fast });
    },
  };

  const sharedProps = {
    onPress,
    disabled: inativo,
    accessibilityRole: "button" as const,
    accessibilityLabel: children,
    accessibilityState: { disabled: inativo, busy: loading },
    "aria-busy": loading,
  };

  const label = loading ? (
    <ActivityIndicator color={cor.texto} size="small" />
  ) : (
    <Text style={[styles.texto, { color: cor.texto }]}>{children}</Text>
  );
  const conteudo = soft ? <MotionReveal key={loading ? "loading" : "label"}>{label}</MotionReveal> : label;

  const baseStyle = [
    styles.base,
    soft && { minHeight: 48 },
    { backgroundColor: cor.fundo, borderColor: cor.borda ?? "transparent" },
    variant === "primario" && SHADOW.glow,
    inativo && styles.disabled,
  ];

  return soft ? (
    <SoftPressable {...sharedProps} style={baseStyle}>{conteudo}</SoftPressable>
  ) : (
    <AnimatedPressable {...sharedProps} {...pressHandlers} style={[...baseStyle, animatedStyle]}>{conteudo}</AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: TOUCH_TARGET,
    borderRadius: RADIUS.control,
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
