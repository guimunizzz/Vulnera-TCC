/**
 * screen.tsx
 *
 * Wrapper padrão de tela: SafeAreaView (evita notch/ilha dinâmica/barra de
 * status) + fundo canvas do tema + padding consistente. Toda tela usa este
 * componente em vez de <View> cru — é o que garante que as 5 telas do app
 * pareçam a mesma família visual em vez de 5 experimentos soltos.
 */

import type { ReactNode } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS, SPACING } from "../theme/tokens";

export function Screen({
  children,
  scroll = true,
  onRefresh,
  refreshing = false,
  contentBottomPadding,
}: {
  children: ReactNode;
  /** false pra telas que já têm sua própria lista rolável (FlatList) — evita ScrollView aninhado. */
  scroll?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
  /** Sobrescreve o padding inferior do conteúdo rolável — usado pelas telas dentro de (tabs) pra reservar espaço sob a tab bar flutuante (ver useTabBarClearance). Ignorado quando `scroll` é false. */
  contentBottomPadding?: number;
}) {
  if (!scroll) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <View style={styles.flex}>{children}</View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={[styles.content, contentBottomPadding != null && { paddingBottom: contentBottomPadding }]}
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accentInk} />
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
    backgroundColor: COLORS.canvas,
  },
  flex: {
    flex: 1,
  },
  content: {
    padding: SPACING[4],
    gap: SPACING[4],
  },
});
