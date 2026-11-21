/**
 * Exibe a arte original da Vuvu em um recorte do atlas usado na Web.
 * O chat mobile usa o retrato no cabeçalho e o aceno na abertura da conversa.
 */
import { useEffect, useState } from "react";
import { Image, StyleSheet, View, type ImageSourcePropType } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";
import { useAppTheme } from "../theme/use-app-theme";
import { useWorkspaceReducedMotion } from "./workspace-motion";

// Cópia idêntica de app/web/src/assets/vuvu/spritesheet.png para o Metro mobile.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const sprite: ImageSourcePropType = require("../../assets/vuvu/spritesheet.png");
const atlas = { columns: 8, rows: 11, cellAspect: 208 / 192 };
const idle = { row: 0, column: 0 };
// O atlas mantém a silhueta de frente. A mão passa pelo quadro alto antes de estender e recolher.
const greeting = [
  { row: 3, column: 0, hold: 65 },
  { row: 3, column: 1, hold: 120 },
  { row: 3, column: 2, hold: 155 },
  { row: 3, column: 1, hold: 110 },
  { row: 3, column: 2, hold: 135 },
  { row: 3, column: 1, hold: 95 },
  { row: 3, column: 3, hold: 60 },
  { row: 0, column: 2, hold: 105 },
];
const WEIGHT_EASING = Easing.inOut(Easing.cubic);

export function AssistantMascot({ width, greet = false }: { width: number; greet?: boolean }) {
  const { colors } = useAppTheme();
  const reduced = useWorkspaceReducedMotion();
  const [greetingFrame, setGreetingFrame] = useState(-1);
  const [failed, setFailed] = useState(false);
  const weight = useSharedValue(0);
  const height = width * atlas.cellAspect;
  const playing = greet && !reduced && !failed;

  useEffect(() => {
    weight.value = 0;
    if (!playing) {
      setGreetingFrame(-1);
      return;
    }
    // O peso do corpo volta ao centro antes de a mão concluir o aceno.
    weight.value = withSequence(withTiming(1, { duration: 210, easing: WEIGHT_EASING }), withTiming(0, { duration: 330, easing: WEIGHT_EASING }));
    let timer: ReturnType<typeof setTimeout>;
    function showFrame(index: number) {
      const pose = greeting[index];
      setGreetingFrame(pose ? index : -1);
      if (pose) timer = setTimeout(() => showFrame(index + 1), pose.hold);
    }
    showFrame(0);
    return () => { clearTimeout(timer); cancelAnimation(weight); };
  }, [playing, weight]);
  const motion = useAnimatedStyle(() => ({
    transform: [{ translateY: playing ? -3 * weight.value : 0 }, { rotate: `${playing ? -2.5 * weight.value : 0}deg` }],
  }));

  const pose = (playing ? greeting[greetingFrame] : undefined) ?? idle;
  return <View
    pointerEvents="none"
    accessibilityElementsHidden
    importantForAccessibility="no-hide-descendants"
    style={[styles.outer, { width, height }]}
  >
    {failed ? <Ionicons name="sparkles-outline" size={width * 0.5} color={colors.assistantInk} /> :
      <Animated.View testID={greet ? "vuvu-greeting" : undefined} style={[styles.frame, { width, height }, motion]}>
        <Image source={sprite} resizeMode="stretch" resizeMethod="scale" fadeDuration={0} onError={() => setFailed(true)}
          style={{ position: "absolute", width: width * atlas.columns, height: height * atlas.rows, top: -height * pose.row, left: -width * pose.column }} />
      </Animated.View>}
  </View>;
}

const styles = StyleSheet.create({ outer: { alignItems: "center", justifyContent: "center" }, frame: { overflow: "hidden" } });
