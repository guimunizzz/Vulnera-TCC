/**
 * Feedback visual da marca após uma tentativa de acesso. A confirmação
 * eleva o símbolo e uma falha desloca o símbolo lateralmente por um instante.
 * Consumidor: login, que mantém a mensagem e o feedback tátil acessíveis.
 */
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";
import { useAppTheme } from "../theme/use-app-theme";
import { VulneraMark } from "./vulnera-mark";
import { SOFT_MOTION, useWorkspaceReducedMotion } from "./workspace-motion";

export const LOGIN_CONFIRMATION_MS = 360;
const PREPARATION_MS = 60;
const RISE_MS = 135;
const SHAKE_EASING = Easing.inOut(Easing.quad);

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
        withTiming(-0.28, { duration: PREPARATION_MS, easing: SHAKE_EASING }),
        withTiming(1, { ...SOFT_MOTION, duration: RISE_MS }),
        withTiming(0, { duration: LOGIN_CONFIRMATION_MS - PREPARATION_MS - RISE_MS, easing: SHAKE_EASING }),
      );
    } else {
      shake.value = withSequence(
        withTiming(-7, { duration: 55, easing: SHAKE_EASING }),
        withTiming(6, { duration: 70, easing: SHAKE_EASING }),
        withTiming(-3, { duration: 65, easing: SHAKE_EASING }),
        withTiming(0, { duration: 80, easing: SHAKE_EASING }),
      );
    }
    return () => { cancelAnimation(lift); cancelAnimation(shake); };
  }, [feedback, lift, reduced, shake]);

  const motion = useAnimatedStyle(() => ({
    transform: [
      { translateX: reduced ? 0 : shake.value },
      { translateY: reduced ? 0 : -6 * lift.value },
      { scale: reduced ? 1 : 1 + 0.1 * lift.value },
    ],
  }));

  return <Animated.View testID={`login-mark-${feedback?.kind ?? "idle"}`} style={[styles.mark, motion]}>
    {feedback?.kind === "success" && <View testID="login-success-halo" pointerEvents="none"
      style={[styles.halo, { backgroundColor: colors.accentSurface, borderColor: colors.accent }]} />}
    <VulneraMark size={60} />
  </Animated.View>;
}

const styles = StyleSheet.create({
  mark: { alignItems: "center", justifyContent: "center", width: 60, height: 60 },
  halo: { position: "absolute", width: 54, height: 54, borderWidth: 1, borderRadius: 27 },
});
