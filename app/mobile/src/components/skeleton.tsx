/**
 * skeleton.tsx
 *
 * Placeholder "pulsante" no formato do conteúdo real, em vez de um spinner
 * central parado — mesma ideia do skeleton loading do Mercado Livre/
 * Instagram. `SkeletonBlock` é a peça crua (retângulo pulsando);
 * `ProjectCardSkeleton`/`FindingRowSkeleton` já vêm no formato dos cards
 * reais pra lista de loading não "pular" quando o dado chega.
 */

import { useEffect, type ReactElement } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming, Easing } from "react-native-reanimated";
import { COLORS, RADIUS, SPACING } from "../theme/tokens";

export function SkeletonBlock({
  width,
  height,
  radius = RADIUS.control,
  style,
}: {
  width: number | `${number}%`;
  height: number;
  radius?: number;
  style?: object;
}) {
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        { width, height, borderRadius: radius, backgroundColor: COLORS.raised },
        animatedStyle,
        style,
      ]}
    />
  );
}

export function ProjectCardSkeleton() {
  return (
    <View style={styles.row}>
      <SkeletonBlock width={44} height={44} radius={RADIUS.full} />
      <View style={styles.info}>
        <SkeletonBlock width="70%" height={16} />
        <SkeletonBlock width="40%" height={12} />
        <SkeletonBlock width={72} height={20} radius={RADIUS.full} />
      </View>
    </View>
  );
}

export function FindingRowSkeleton() {
  return (
    <View style={styles.row}>
      <SkeletonBlock width={44} height={44} radius={RADIUS.full} />
      <View style={styles.info}>
        <SkeletonBlock width="85%" height={14} />
        <View style={{ flexDirection: "row", gap: SPACING[2] }}>
          <SkeletonBlock width={64} height={20} radius={RADIUS.full} />
          <SkeletonBlock width={64} height={20} radius={RADIUS.full} />
        </View>
      </View>
    </View>
  );
}

/** Lista de N skeletons — usar no lugar de <LoadingState/> quando o formato final já é conhecido (listas). */
export function SkeletonList({
  count = 4,
  Item,
}: {
  count?: number;
  Item: () => ReactElement;
}) {
  return (
    <View style={{ gap: SPACING[3], padding: SPACING[4] }}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.card}>
          <Item />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.container,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    padding: SPACING[4],
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING[3],
  },
  info: {
    flex: 1,
    gap: SPACING[2],
  },
});
