/**
 * Feedback visual da marca após uma tentativa de acesso. A confirmação
 * eleva o símbolo e uma falha desloca o símbolo lateralmente por um instante.
 * Consumidor: login, que mantém a mensagem e o feedback tátil acessíveis.
 */
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";
import { useAppTheme } from "../theme/use-app-theme";
import { VulneraMark } from "./vulnera-mark";
import { SOFT_MOTION, useWorkspaceReducedMotion } from "./workspace-motion";

export const LOGIN_CONFIRMATION_MS = 360;

export function LoginMark({ feedback }: { feedback: { kind: "success" | "failure" } | null }) {
  const { colors } = useAppTheme();
  const reduced = useWorkspaceReducedMotion();
  const lift = useSharedValue(0);
  const shake = useSharedValue(0);

  useEffect(() => {
    lift.value = 0;
    shake.value = 0;
    if (!feedback || reduced) return;

    if (feedback.kind === "success") {
      lift.value = withSequence(
        withTiming(1, { ...SOFT_MOTION, duration: 150 }),
        withTiming(0, { ...SOFT_MOTION, duration: LOGIN_CONFIRMATION_MS - 150 }),
      );
    } else {
      shake.value = withSequence(
        withTiming(-7, { duration: 55 }),
        withTiming(6, { duration: 70 }),
        withTiming(-3, { duration: 65 }),
        withTiming(0, { duration: 80 }),
      );
    }
    return () => { cancelAnimation(lift); cancelAnimation(shake); };
  }, [feedback, lift, reduced, shake]);

  const motion = useAnimatedStyle(() => ({
    transform: [{ translateX: shake.value }, { translateY: -6 * lift.value }, { scale: 1 + 0.1 * lift.value }],
  }));

  return <Animated.View testID={`login-mark-${feedback?.kind ?? "idle"}`} style={[styles.mark, motion]}>
    {feedback?.kind === "success" && <View testID="login-success-halo" pointerEvents="none"
      style={[styles.halo, { backgroundColor: colors.highlightSurface, borderColor: colors.highlightBorder }]} />}
    <VulneraMark size={60} />
  </Animated.View>;
}

const styles = StyleSheet.create({
  mark: { alignItems: "center", justifyContent: "center", width: 60, height: 60 },
  halo: { position: "absolute", width: 54, height: 54, borderWidth: 1, borderRadius: 27 },
});
