/**
 * Exibe a arte original da Vuvu em um recorte do atlas usado na Web.
 * O chat mobile usa o retrato no cabeçalho e o aceno na abertura da conversa.
 */
import { useEffect, useState } from "react";
import { Image, StyleSheet, View, type ImageSourcePropType } from "react-native";
import { useWorkspaceReducedMotion } from "./workspace-motion";

// Cópia idêntica de app/web/src/assets/vuvu/spritesheet.png para o Metro mobile.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const sprite: ImageSourcePropType = require("../../assets/vuvu/spritesheet.png");
const atlas = { columns: 8, rows: 11, cellAspect: 208 / 192, greetingRow: 3, greetingFrames: 4, frameMs: 220 };

export function AssistantMascot({ width, greet = false }: { width: number; greet?: boolean }) {
  const reduced = useWorkspaceReducedMotion();
  const [greetingFrame, setGreetingFrame] = useState(0);
  const [failed, setFailed] = useState(false);
  const height = width * atlas.cellAspect;

  useEffect(() => {
    if (!greet || reduced || failed) return;
    let frame = 0;
    setGreetingFrame(1);
    const timer = setInterval(() => {
      frame += 1;
      setGreetingFrame(frame < atlas.greetingFrames ? frame + 1 : 0);
      if (frame === atlas.greetingFrames) clearInterval(timer);
    }, atlas.frameMs);
    return () => clearInterval(timer);
  }, [greet, reduced, failed]);

  const frame = greet && !reduced ? greetingFrame : 0;
  return <View
    pointerEvents="none"
    accessibilityElementsHidden
    importantForAccessibility="no-hide-descendants"
    style={[styles.frame, { width, height }]}
  >
    {!failed && <Image
      source={sprite}
      resizeMode="stretch"
      resizeMethod="scale"
      fadeDuration={0}
      onError={() => setFailed(true)}
      style={{ position: "absolute", width: width * atlas.columns, height: height * atlas.rows, top: frame ? -height * atlas.greetingRow : 0, left: frame ? -(frame - 1) * width : 0 }}
    />}
  </View>;
}

const styles = StyleSheet.create({ frame: { overflow: "hidden" } });
