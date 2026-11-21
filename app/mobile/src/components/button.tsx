import { ActivityIndicator, StyleSheet, Text } from "react-native";
import { FONT_FAMILY, FONT_SIZE, RADIUS, SHADOW, SPACING } from "../theme/tokens";
import { useAppTheme, type AppColors } from "../theme/use-app-theme";
import { SoftPressable } from "./workspace-motion";

type Variant = "primario" | "secundario" | "perigo";

function getVariants(colors: AppColors): Record<Variant, { fundo: string; texto: string; borda?: string }> {
  return {
    primario: { fundo: colors.accent, texto: colors.accentFg },
    secundario: { fundo: "transparent", texto: colors.textPrimary, borda: colors.borderDefault },
    perigo: { fundo: "transparent", texto: colors.dangerInk, borda: colors.danger },
  };
}

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
  const { colors } = useAppTheme();
  const cor = getVariants(colors)[variant];
  const inativo = disabled || loading;
  return (
    <SoftPressable onPress={onPress} disabled={inativo} accessibilityRole="button" accessibilityLabel={children}
      accessibilityState={{ disabled: inativo, busy: loading }} aria-busy={loading}
      style={[styles.base, { backgroundColor: cor.fundo, borderColor: cor.borda ?? "transparent" }, variant === "primario" && SHADOW.glow]}>
      {loading && <ActivityIndicator color={cor.texto} size="small" />}
      <Text accessibilityLiveRegion="polite" style={[styles.texto, { color: cor.texto }]}>{children}</Text>
    </SoftPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: RADIUS.control,
    borderWidth: 1,
    paddingHorizontal: SPACING[6],
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: SPACING[2],
  },
  texto: {
    fontSize: FONT_SIZE.sm,
    fontFamily: FONT_FAMILY.semibold,
  },
});
