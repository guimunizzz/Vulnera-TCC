/**
 * vulnera-mark.tsx
 *
 * Marca "V" oficial (duas polylines convergindo) redesenhada em SVG para rodar
 * nativamente no React Native, com cor de acento sensível ao tema ativo.
 */

import { useEffect } from "react";
import { View } from "react-native";
import Svg, { Polyline } from "react-native-svg";
import Animated, { Easing, useAnimatedProps, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { useAppTheme } from "../theme/use-app-theme";

const AnimatedPolyline = Animated.createAnimatedComponent(Polyline);
const DASH_LENGTH = 100;

export function VulneraMark({ size = 72 }: { size?: number }) {
  const { colors } = useAppTheme();
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
          stroke={colors.accent}
          strokeWidth={7}
          strokeLinecap="square"
          strokeLinejoin="miter"
          strokeDasharray={DASH_LENGTH}
          animatedProps={leftProps}
        />
        <AnimatedPolyline
          points="90,10 60,45 50,85"
          stroke={colors.accent}
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
