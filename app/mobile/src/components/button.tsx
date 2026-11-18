import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { BlurView } from "expo-blur";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { FONT_FAMILY, FONT_SIZE, MOTION, RADIUS, SHADOW, SPACING, TOUCH_TARGET } from "../theme/tokens";
import { useAppTheme, type AppColors } from "../theme/use-app-theme";
import { MotionReveal, SoftPressable } from "./workspace-motion";

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
  glass = false,
  soft = false,
}: {
  children: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  glass?: boolean;
  soft?: boolean;
}) {
  const { isDark, colors, workspace } = useAppTheme();
  const cor = getVariants(colors)[variant];
  const inativo = disabled || loading;
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const pressHandlers = {
    onPressIn: () => {
      scale.value = withTiming(0.96, { duration: MOTION.fast });
    },
    onPressOut: () => {
      scale.value = withTiming(1, { duration: MOTION.fast });
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

  if (variant === "primario" && glass) {
    const outerStyle = [
      styles.glassOuter,
      { borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(112,70,207,0.35)" },
      soft && { minHeight: 48 },
      SHADOW.glow,
      inativo && styles.disabled,
    ];
    const inner = (
      <View style={styles.glassInner}>
        {Platform.OS !== "android" && (
          <BlurView intensity={40} tint={workspace.blurTint} pointerEvents="none" style={StyleSheet.absoluteFill} />
        )}
        <View
          pointerEvents="none"
          style={[
            styles.glassTint,
            { backgroundColor: colors.accent, opacity: isDark ? (Platform.OS === "android" ? 0.85 : 0.38) : 0.92 },
          ]}
        />
        {conteudo}
      </View>
    );
    return soft ? (
      <SoftPressable {...sharedProps} style={outerStyle}>{inner}</SoftPressable>
    ) : (
      <AnimatedPressable {...sharedProps} {...pressHandlers} style={[...outerStyle, animatedStyle]}>{inner}</AnimatedPressable>
    );
  }

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
  glassOuter: {
    minHeight: TOUCH_TARGET,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  glassInner: {
    flex: 1,
    borderRadius: RADIUS.full,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING[6],
  },
  glassTint: {
    ...StyleSheet.absoluteFill,
  },
});
