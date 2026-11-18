/**
 * Indicador CVSS com preenchimento suave e valor real sempre legível nos
 * temas escuro e claro.
 * Consumidor: detalhe autenticado de vulnerabilidade.
 */
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import Animated, { cancelAnimation, useAnimatedProps, useSharedValue, withTiming } from "react-native-reanimated";
import { FONT_FAMILY } from "../theme/tokens";
import { useAppTheme } from "../theme/use-app-theme";
import { SOFT_MOTION, useWorkspaceReducedMotion } from "./workspace-motion";
import { getSeverityColors } from "./badge";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const circumference = 2 * Math.PI * 34;

export function CvssRing({ score, severity }: { score: number | null; severity: string }) {
  const reduced = useWorkspaceReducedMotion();
  const { colors, workspace } = useAppTheme();
  const palette = getSeverityColors(colors);
  const color = (palette[severity as keyof typeof palette] ?? palette.NONE).ponto;
  const portion = score == null ? 0 : Math.max(0, Math.min(10, score)) / 10;
  const progress = useSharedValue(reduced ? portion : 0);
  useEffect(() => {
    progress.value = withTiming(portion, { ...SOFT_MOTION, duration: reduced ? 0 : 480 });
    return () => cancelAnimation(progress);
  }, [portion, reduced, progress]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: circumference * (1 - progress.value) }));
  return <View style={styles.ring} accessible accessibilityLabel={score != null ? `CVSS ${score.toFixed(1)} de 10` : "CVSS não informado"}>
    <Svg width={88} height={88} style={StyleSheet.absoluteFill} accessibilityElementsHidden>
      <Circle cx={44} cy={44} r={34} fill="none" stroke={workspace.line} strokeWidth={4} />
      {score != null && <AnimatedCircle cx={44} cy={44} r={34} fill="none" stroke={color} strokeWidth={4} strokeLinecap="round"
        strokeDasharray={`${circumference} ${circumference}`} animatedProps={props} rotation={-90} origin="44,44" />}
    </Svg>
    <Text style={[styles.score, { color: workspace.text }]}>{score != null ? score.toFixed(1) : "—"}</Text>
    <Text style={[styles.label, { color: workspace.muted }]}>CVSS</Text>
  </View>;
}
const styles = StyleSheet.create({
  ring: { width: 88, height: 88, alignItems: "center", justifyContent: "center", gap: 2 },
  score: { fontFamily: FONT_FAMILY.medium, fontSize: 26, lineHeight: 32 },
  label: { fontFamily: FONT_FAMILY.medium, fontSize: 12 },
});
