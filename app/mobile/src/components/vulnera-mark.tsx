/**
 * Símbolo V vetorizado a partir da referência visual fornecida pelo usuário.
 * Mantém transparência e nitidez nos temas claro e escuro; usado no login e nos cabeçalhos.
 */
import { useEffect, useId } from "react";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useAppTheme } from "../theme/use-app-theme";
import { useWorkspaceReducedMotion } from "./workspace-motion";

export function VulneraMark({ size = 72, animate = true }: { size?: number; animate?: boolean }) {
  const { isDark } = useAppTheme();
  const reduced = useWorkspaceReducedMotion();
  const id = `vulnera-mark-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const opacity = useSharedValue(animate && !reduced ? 0 : 1);
  useEffect(() => { opacity.value = withTiming(1, { duration: animate && !reduced ? 550 : 0 }); }, [animate, opacity, reduced]);
  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return <Animated.View accessible={false} style={[{ width: size, height: size }, animatedStyle]}>
    <Svg width={size} height={size} viewBox="-38 -10 418 399" accessible={false}>
      <Defs><LinearGradient id={id} x1="0" y1="0" x2="0" y2="379" gradientUnits="userSpaceOnUse">
        <Stop offset="0" stopColor={isDark ? "#c679cb" : "#85359b"} />
        <Stop offset="1" stopColor={isDark ? "#8823a8" : "#681184"} />
      </LinearGradient></Defs>
      <Path d="M 0 14 L 24 25 L 167 339 L 307 37 L 261 56 L 167 253 L 70 45 L 147 74 L 102 69 L 167 211 L 247 40 L 342 0 L 167 379 Z" fill={`url(#${id})`} />
    </Svg>
  </Animated.View>;
}
