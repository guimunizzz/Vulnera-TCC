/**
 * Superfícies e estrutura das telas autenticadas. O conteúdo usa a mesma
 * hierarquia de cor e os mesmos controles nos temas escuro e claro.
 * Consumidores: Home, Relatórios, detalhes de projeto/finding e Configurações.
 */
import { useEffect, type ReactNode } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, type Href } from "expo-router";
import { FONT_FAMILY, RADIUS, SPACING } from "../theme/tokens";
import { useAppTheme } from "../theme/use-app-theme";
import { useAuthStore } from "../store/auth.store";
import { useTabBarClearance } from "../hooks/use-tab-bar-clearance";
import { haptics } from "../lib/haptics";
import { WorkspaceContentMotionProvider, SoftPressable, SOFT_MOTION, useWorkspaceReducedMotion, WorkspaceAtmosphere } from "./workspace-motion";
import { HomeBrand } from "./home-brand";
import { AssistantButton } from "./assistant";
import type { AssistantScreen } from "../lib/assistant-context";

export function Surface({ children, style, onPress, accessibilityLabel, strong = false }: {
  children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; accessibilityLabel?: string; strong?: boolean;
}) {
  const { workspace } = useAppTheme();
  const surfaceStyle = [
    styles.surface,
    { borderColor: workspace.line, backgroundColor: strong ? workspace.raised : workspace.surface },
    style,
  ];
  return onPress ? <SoftPressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={() => { haptics.tap(); onPress(); }}
    style={surfaceStyle}>{children}</SoftPressable> : <View style={surfaceStyle}>{children}</View>;
}

export function WorkspaceScreen({ children, scroll = true, refreshing = false, onRefresh }: {
  children: ReactNode; scroll?: boolean; refreshing?: boolean; onRefresh?: () => void;
}) {
  const bottom = useTabBarClearance();
  const { workspace } = useAppTheme();
  return <WorkspaceContentMotionProvider><SafeAreaView edges={["top", "left", "right"]} style={[styles.screen, { backgroundColor: workspace.background }]}>
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: workspace.background }]}>
      <WorkspaceAtmosphere />
    </View>
    {scroll ? <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: bottom + 16 }}
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={workspace.lavender} colors={[workspace.purple]} /> : undefined}>
      <View style={styles.content}>{children}</View></ScrollView> : <View style={styles.flex}>{children}</View>}
  </SafeAreaView></WorkspaceContentMotionProvider>;
}

export function PageHeader({ label, back = false, backFallback = "/(tabs)/home", assistantContext, account = false }: { label?: string; back?: boolean; backFallback?: Href; assistantContext?: AssistantScreen; account?: boolean }) {
  const router = useRouter();
  const { workspace, ui } = useAppTheme();
  const initial = useAuthStore((state) => state.user?.name?.trim().charAt(0).toUpperCase()) || "?";
  return <View style={styles.header}>
    {back ? <SoftPressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={() => { haptics.tap(); if (router.canGoBack()) router.back(); else router.replace(backFallback); }} style={[styles.iconButton, { borderColor: workspace.line, backgroundColor: workspace.neutralTint }]}>
      <Ionicons name="arrow-back" size={22} color={workspace.text} /></SoftPressable>
      : <HomeBrand />}
    <View style={ui.grow}>{label && <Text style={[ui.eyebrow, !back && styles.brandLabel]}>{label}</Text>}</View>
    <AssistantButton screen={assistantContext} />
    {account && <SoftPressable accessibilityRole="button" accessibilityLabel="Abrir minha conta"
      onPress={() => { haptics.tap(); router.push("/(tabs)/settings"); }}
      style={[styles.iconButton, { backgroundColor: workspace.neutralTint, borderColor: workspace.line }]}>
      <Text style={ui.heading}>{initial}</Text>
    </SoftPressable>}
  </View>;
}

export function SectionHeading({ title, meta }: { title: string; meta?: string }) {
  const { ui } = useAppTheme();
  return <View style={ui.spread}><Text accessibilityRole="header" style={ui.heading}>{title}</Text>{meta && <Text style={ui.mono}>{meta}</Text>}</View>;
}

export function FilterChip({ label, selected, onPress, tab = false }: { label: string; selected: boolean; onPress: () => void; tab?: boolean }) {
  const { workspace } = useAppTheme();
  const reduced = useWorkspaceReducedMotion();
  const progress = useSharedValue(selected ? 1 : 0);
  useEffect(() => { progress.value = withTiming(selected ? 1 : 0, { ...SOFT_MOTION, duration: reduced ? 0 : 190 }); }, [selected, reduced, progress]);
  const highlight = useAnimatedStyle(() => ({ opacity: progress.value }));
  return <SoftPressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected }} onPress={() => { haptics.tap(); onPress(); }}
    style={[styles.chip, { borderColor: workspace.line, backgroundColor: workspace.chipBg }, tab && styles.tabChip]}>
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.chipActive, { borderColor: workspace.chipActiveBorder, backgroundColor: workspace.chipActiveBg }, highlight]} />
    <Text style={[styles.chipText, { color: workspace.muted }, tab && styles.tabChipText, selected && { color: workspace.text }]}>{label}</Text>
  </SoftPressable>;
}

export function ActionButton({ label, onPress, disabled = false, variant = "secondary", icon = "refresh-outline" }: {
  label: string; onPress: () => void; disabled?: boolean; variant?: "primary" | "secondary" | "danger"; icon?: keyof typeof Ionicons.glyphMap;
}) {
  const { colors, workspace } = useAppTheme();
  const appearance = {
    primary: { ink: colors.accentFg, borderColor: colors.accent, backgroundColor: colors.accent },
    secondary: { ink: workspace.lavender, borderColor: workspace.actionBorder, backgroundColor: workspace.actionBg },
    danger: { ink: workspace.dangerInk, borderColor: workspace.dangerActionBorder, backgroundColor: workspace.dangerActionBg },
  }[variant];
  return <SoftPressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={() => { haptics.tap(); onPress(); }}
    style={[styles.action, { borderColor: appearance.borderColor, backgroundColor: appearance.backgroundColor }]}>
    <Ionicons name={icon} size={18} color={appearance.ink} /><Text style={[styles.actionText, { color: appearance.ink }]}>{label}</Text>
  </SoftPressable>;
}

export function DataState({ title, message, loading = false, error = false, onRetry }: {
  title: string; message?: string; loading?: boolean; error?: boolean; onRetry?: () => void;
}) {
  const { workspace, ui } = useAppTheme();
  return <Surface style={styles.state}>
    <View style={[styles.stateIcon, { backgroundColor: error ? workspace.dangerActionBg : workspace.neutralTint }]}>
      {loading ? <ActivityIndicator color={workspace.lavender} /> : <Ionicons name={error ? "cloud-offline-outline" : "layers-outline"} size={25} color={error ? workspace.dangerInk : workspace.secondary} />}
    </View><Text accessibilityRole="header" style={[ui.heading, { fontSize: 17, textAlign: "center" }]}>{title}</Text>
    {message && <Text accessibilityLiveRegion={error ? "polite" : "none"} style={[ui.muted, { textAlign: "center" }]}>{message}</Text>}
    {onRetry && <ActionButton label="Tentar novamente" onPress={onRetry} />}
  </Surface>;
}

export function DetailField({ label, value }: { label: string; value: string }) {
  const { ui } = useAppTheme();
  return <View style={{ gap: 6 }}><Text style={ui.eyebrow}>{label}</Text><Text style={ui.body}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, overflow: "hidden" }, flex: { flex: 1 }, content: { paddingHorizontal: SPACING[5], gap: SPACING[5] },
  surface: { borderRadius: RADIUS.container, borderWidth: 1, padding: SPACING[5], gap: SPACING[4] },
  header: { flexDirection: "row", alignItems: "center", gap: SPACING[2], minHeight: 64, paddingVertical: SPACING[2] },
  brandLabel: { textAlign: "right" },
  iconButton: { width: 48, height: 48, alignItems: "center", justifyContent: "center", borderRadius: RADIUS.control, borderWidth: 1 },
  chip: { minHeight: 48, minWidth: 48, paddingHorizontal: 16, paddingVertical: 10, flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 18, overflow: "hidden" },
  chipActive: { borderRadius: 17, borderWidth: 1 }, chipText: { fontFamily: FONT_FAMILY.medium, fontSize: 14 },
  tabChip: { flex: 1, minWidth: 0, paddingHorizontal: 8, justifyContent: "center" }, tabChipText: { fontSize: 13, textAlign: "center", flexShrink: 1 },
  action: { minHeight: 48, paddingHorizontal: SPACING[4], paddingVertical: SPACING[3], flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACING[2], borderRadius: RADIUS.control, borderWidth: 1 },
  actionText: { fontFamily: FONT_FAMILY.medium, fontSize: 14, flexShrink: 1, textAlign: "center" },
  state: { alignItems: "center", paddingVertical: 32, gap: 14 }, stateIcon: { width: 52, height: 52, borderRadius: 18, alignItems: "center", justifyContent: "center" },
});
