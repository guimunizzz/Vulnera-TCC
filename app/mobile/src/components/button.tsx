import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { COLORS, FONT_SIZE, FONT_WEIGHT, RADIUS, SPACING, TOUCH_TARGET } from "../theme/tokens";

type Variant = "primario" | "secundario" | "perigo";

const VARIANTES: Record<Variant, { fundo: string; texto: string; borda?: string }> = {
  primario: { fundo: COLORS.accent, texto: COLORS.accentFg },
  secundario: { fundo: "transparent", texto: COLORS.textPrimary, borda: COLORS.borderDefault },
  perigo: { fundo: "transparent", texto: COLORS.dangerInk, borda: COLORS.danger },
};

/** Botão com alvo de toque garantido em 44px (WCAG 2.5.5/2.5.8 — mesmo mínimo do web). */
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

  return (
    <Pressable
      onPress={onPress}
      disabled={inativo}
      accessibilityRole="button"
      accessibilityState={{ disabled: inativo, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: cor.fundo, borderColor: cor.borda ?? "transparent" },
        inativo && styles.disabled,
        pressed && !inativo && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={cor.texto} size="small" />
      ) : (
        <Text style={[styles.texto, { color: cor.texto }]}>{children}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: TOUCH_TARGET,
    borderRadius: RADIUS.control,
    borderWidth: 1,
    paddingHorizontal: SPACING[4],
    alignItems: "center",
    justifyContent: "center",
  },
  texto: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.85,
  },
});
