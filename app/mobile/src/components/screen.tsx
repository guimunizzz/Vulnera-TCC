import type { ReactNode } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SPACING } from "../theme/tokens";
import { useAppTheme } from "../theme/use-app-theme";

export function Screen({
  children,
  scroll = true,
  onRefresh,
  refreshing = false,
  contentBottomPadding,
}: {
  children: ReactNode;
  scroll?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
  contentBottomPadding?: number;
}) {
  const { colors } = useAppTheme();
  if (!scroll) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.canvas }]} edges={["top", "left", "right"]}>
        <View style={styles.flex}>{children}</View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.canvas }]} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={[styles.content, contentBottomPadding != null && { paddingBottom: contentBottomPadding }]}
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentInk} />
          ) : undefined
        }
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  content: {
    padding: SPACING[4],
    gap: SPACING[4],
  },
});
