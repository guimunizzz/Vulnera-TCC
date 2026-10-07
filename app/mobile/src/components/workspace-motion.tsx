/**
 * Movimento compartilhado das telas autenticadas: toque, entrada e rolagem.
 * Mantém durações curtas e deslocamentos discretos; respeita acessibilidade.
 * Consumidores: componentes de vidro e telas de acompanhamento do cliente.
 */
import { createContext, useCallback, useContext, useEffect, useId, useState, type ReactNode } from "react";
import { AccessibilityInfo, AppState, Platform, Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import { useFocusEffect } from "expo-router";
import Animated, { cancelAnimation, Easing, LinearTransition, useAnimatedScrollHandler, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSpring, withTiming, type SharedValue } from "react-native-reanimated";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";

export const SOFT_MOTION = { duration: 280, easing: Easing.bezier(0.22, 1, 0.36, 1) };
const RELEASE = { damping: 26, stiffness: 260, mass: 0.8, overshootClamping: true };
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const ReducedMotionContext = createContext(true);

function useReducedMotionPreference() {
  const initial = useReducedMotion();
  const [reduced, setReduced] = useState(initial);
  useEffect(() => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const media = window.matchMedia("(prefers-reduced-motion: reduce)");
      const update = () => setReduced(media.matches);
      update(); media.addEventListener("change", update);
      return () => media.removeEventListener("change", update);
    }
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (mounted) setReduced(value); });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => { mounted = false; subscription.remove(); };
  }, []);
  return reduced;
}

export function WorkspaceMotionProvider({ children }: { children: ReactNode }) {
  const reduced = useReducedMotionPreference();
  return <ReducedMotionContext.Provider value={reduced}>{children}</ReducedMotionContext.Provider>;
}

export function useWorkspaceReducedMotion() { return useContext(ReducedMotionContext); }

export function SoftPressable({ style, onPressIn, onPressOut, disabled, ...props }: Omit<PressableProps, "style"> & { style?: StyleProp<ViewStyle> }) {
  const reduced = useWorkspaceReducedMotion();
  const progress = useSharedValue(0);
  const animated = useAnimatedStyle(() => ({ opacity: 1 - progress.value * 0.12, transform: [{ scale: 1 - progress.value * 0.018 }] }));
  return <AnimatedPressable {...props} disabled={disabled} style={[style, animated, disabled && { opacity: 0.5 }]}
    onPressIn={(event) => { progress.value = reduced ? 0 : withTiming(1, { duration: 100 }); onPressIn?.(event); }}
    onPressOut={(event) => { progress.value = reduced ? 0 : withSpring(0, RELEASE); onPressOut?.(event); }} />;
}

export function MotionReveal({ children, delay = 0, style, layout = false }: { children: ReactNode; delay?: number; style?: StyleProp<ViewStyle>; layout?: boolean }) {
  const reduced = useWorkspaceReducedMotion();
  const progress = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    progress.value = reduced ? 1 : withDelay(Math.min(delay, 180), withTiming(1, SOFT_MOTION));
    return () => cancelAnimation(progress);
  }, [delay, reduced, progress]);
  const animated = useAnimatedStyle(() => ({ opacity: progress.value, transform: [{ translateY: (1 - progress.value) * 10 }] }));
  return <Animated.View layout={layout && !reduced ? LinearTransition.duration(240).easing(SOFT_MOTION.easing) : undefined} style={[style, animated]}>{children}</Animated.View>;
}

export function useWorkspaceScroll() {
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => { scrollY.value = Math.max(0, event.contentOffset.y); });
  return { scrollY, onScroll };
}

export function WorkspaceAtmosphere({ scrollY }: { scrollY?: SharedValue<number> }) {
  const gradientId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const reduced = useWorkspaceReducedMotion();
  const [focused, setFocused] = useState(false);
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  const [active, setActive] = useState(AppState.currentState === "active");
  const drift = useSharedValue(0);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => setActive(state === "active"));
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    if (focused && active && !reduced) drift.value = withRepeat(withTiming(1, { duration: 9000, easing: Easing.inOut(Easing.sin) }), -1, true);
    else { cancelAnimation(drift); drift.value = 0; }
    return () => cancelAnimation(drift);
  }, [active, focused, reduced, drift]);
  const animated = useAnimatedStyle(() => ({ transform: [
    { translateY: reduced ? 0 : drift.value * 14 - Math.min(scrollY?.value ?? 0, 600) * 0.06 },
    { translateX: reduced ? 0 : drift.value * -10 },
  ] }));
  return <Animated.View testID="workspace-atmosphere" pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    style={[{ position: "absolute", top: -100, left: -80, right: -80, height: 1000 }, animated]}>
    <Svg width="100%" height="100%" viewBox="0 0 550 1000" preserveAspectRatio="xMidYMin slice">
      <Defs><RadialGradient id={`${gradientId}-glow`}><Stop offset="0" stopColor="#9d78ef" stopOpacity="0.24" /><Stop offset="0.55" stopColor="#7c3aed" stopOpacity="0.09" /><Stop offset="1" stopColor="#7c3aed" stopOpacity="0" /></RadialGradient>
        <RadialGradient id={`${gradientId}-mist`}><Stop offset="0" stopColor="#b599f4" stopOpacity="0.1" /><Stop offset="1" stopColor="#b599f4" stopOpacity="0" /></RadialGradient></Defs>
      <Circle cx="440" cy="165" r="300" fill={`url(#${gradientId}-glow)`} /><Circle cx="75" cy="620" r="280" fill={`url(#${gradientId}-mist)`} />
    </Svg>
  </Animated.View>;
}
