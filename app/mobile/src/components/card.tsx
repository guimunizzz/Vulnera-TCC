import { useState, type ReactNode } from "react";
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { RADIUS, SHADOW, SPACING } from "../theme/tokens";
import { useAppTheme } from "../theme/use-app-theme";
import { SoftPressable } from "./workspace-motion";

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
  const [pressed, setPressed] = useState(false);

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
      <SoftPressable
        onPress={onPress}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={styles.outer}
      >
        {glass}
      </SoftPressable>
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
