/**
 * vulnera-mark.tsx
 *
 * Marca "V" oficial (duas polylines convergindo — ver Lockup.dc.html do
 * material de marca) redesenhada em SVG pra rodar nativamente no RN. Só o
 * traço, sem fundo/círculo — desenha a si mesma ao montar (stroke-
 * dashoffset, como uma assinatura sendo traçada).
 */

import { useEffect } from "react";
import { View } from "react-native";
import Svg, { Polyline } from "react-native-svg";
import Animated, { Easing, useAnimatedProps, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { COLORS } from "../theme/tokens";

const AnimatedPolyline = Animated.createAnimatedComponent(Polyline);
// Comprimento aproximado de cada traço (10,10→40,45→50,85 ≈ 87.3) — um
// pouco folgado pra garantir que o traço some por completo no início.
const DASH_LENGTH = 100;

export function VulneraMark({ size = 72 }: { size?: number }) {
  const draw = useSharedValue(DASH_LENGTH);
  const drawDelayed = useSharedValue(DASH_LENGTH);

  useEffect(() => {
    draw.value = withTiming(0, { duration: 700, easing: Easing.out(Easing.cubic) });
    drawDelayed.value = withDelay(140, withTiming(0, { duration: 700, easing: Easing.out(Easing.cubic) }));
  }, [draw, drawDelayed]);

  const leftProps = useAnimatedProps(() => ({ strokeDashoffset: draw.value }));
  const rightProps = useAnimatedProps(() => ({ strokeDashoffset: drawDelayed.value }));

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
        <AnimatedPolyline
          points="10,10 40,45 50,85"
          stroke={COLORS.accent}
          strokeWidth={7}
          strokeLinecap="square"
          strokeLinejoin="miter"
          strokeDasharray={DASH_LENGTH}
          animatedProps={leftProps}
        />
        <AnimatedPolyline
          points="90,10 60,45 50,85"
          stroke={COLORS.accent}
          strokeWidth={7}
          strokeLinecap="square"
          strokeLinejoin="miter"
          strokeDasharray={DASH_LENGTH}
          animatedProps={rightProps}
        />
      </Svg>
    </View>
  );
}
