import { useEffect, type ReactElement } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming, Easing } from "react-native-reanimated";
import { RADIUS, SPACING } from "../theme/tokens";
import { useAppTheme } from "../theme/use-app-theme";

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
  const { colors } = useAppTheme();
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        { width, height, borderRadius: radius, backgroundColor: colors.inset },
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

export function SkeletonList({
  count = 4,
  Item,
}: {
  count?: number;
  Item: () => ReactElement;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={{ gap: SPACING[3], padding: SPACING[4] }}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
          <Item />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.container,
    borderWidth: 1,
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
