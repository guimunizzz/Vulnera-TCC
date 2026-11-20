import { useState, type ReactNode } from "react";
import { Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { MOTION, RADIUS, SHADOW, SPACING } from "../theme/tokens";
import { useAppTheme } from "../theme/use-app-theme";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Card({
  children,
  onPress,
  style,
  accessibilityLabel,
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const { colors, workspace } = useAppTheme();
  const scale = useSharedValue(1);
  const [pressed, setPressed] = useState(false);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const glass = (
    <View style={[styles.inner, style]}>
      {Platform.OS !== "android" && <BlurView intensity={35} tint={workspace.blurTint} style={StyleSheet.absoluteFill} />}
      <View
        style={[
          styles.tint,
          {
            backgroundColor: pressed ? colors.raised : colors.surface,
            opacity: pressed ? 0.65 : 0.55,
          },
        ]}
      />
      {children}
    </View>
  );

  if (onPress) {
    return (
      <AnimatedPressable
        onPress={onPress}
        onPressIn={() => {
          scale.value = withTiming(0.97, { duration: MOTION.fast });
          setPressed(true);
        }}
        onPressOut={() => {
          scale.value = withTiming(1, { duration: MOTION.fast });
          setPressed(false);
        }}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={[styles.outer, animatedStyle]}
        hitSlop={4}
      >
        {glass}
      </AnimatedPressable>
    );
  }
  return <View style={styles.outer}>{glass}</View>;
}

const styles = StyleSheet.create({
  outer: {
    borderRadius: RADIUS.container,
    ...SHADOW.card,
  },
  inner: {
    borderRadius: RADIUS.container,
    overflow: "hidden",
    padding: SPACING[4],
    gap: SPACING[2],
  },
  tint: {
    ...StyleSheet.absoluteFill,
  },
});
