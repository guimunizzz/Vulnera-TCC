import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { COLORS, MOTION, RADIUS, SHADOW, SPACING } from "../theme/tokens";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Superfície de vidro fosco (blur + tint) — mesmo papel do <Card> web
 * (agrupar conteúdo relacionado), agora com glassmorphism em vez de fundo
 * chapado. API não muda (children/onPress/style/accessibilityLabel), então
 * nenhuma das dezenas de telas que já usam Card precisou editar nada — é
 * por isso que esse componente é o primeiro a mudar quando o pedido é
 * "todas as telas".
 *
 * Estrutura em 2 camadas (mesma receita da tab bar flutuante): a de fora
 * carrega a sombra sem `overflow:hidden` (senão corta a sombra no iOS), a
 * de dentro recorta o blur nas pontas arredondadas e recebe o `style` do
 * chamador (padding/gap/flexDirection/bordas extras como a faixa de acento
 * do hero/perfil) — um caller que passasse `backgroundColor` via `style`
 * não teria mais efeito visual, já que o tint fica por cima; nenhum
 * call-site atual faz isso (só gap/flexDirection), confirmado antes dessa
 * mudança.
 */
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

  const glass = (
    <View style={[styles.inner, style]}>
      <BlurView intensity={35} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={[styles.tint, pressed && styles.tintPressed]} />
      {children}
    </View>
  );

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
        style={[styles.outer, animatedStyle]}
        // 44px mínimo de alvo de toque mesmo quando o card é mais baixo que isso
        hitSlop={4}
      >
        {glass}
      </AnimatedPressable>
    );
  }
  return <View style={styles.outer}>{glass}</View>;
}

const styles = StyleSheet.create({
  outer: {
    borderRadius: RADIUS.container,
    ...SHADOW.card,
  },
  inner: {
    borderRadius: RADIUS.container,
    overflow: "hidden",
    padding: SPACING[4],
    gap: SPACING[2],
  },
  tint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.surface,
    opacity: 0.55,
  },
  tintPressed: {
    backgroundColor: COLORS.raised,
    opacity: 0.65,
  },
});
