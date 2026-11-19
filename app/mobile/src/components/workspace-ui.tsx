/**
 * Superfícies liquid glass e estrutura das telas autenticadas.
 * Unifica navegação, contraste e estados de dados nos temas escuro e claro.
 * Consumidores: Home, Relatórios, detalhes de projeto/finding e Configurações.
 */
import { useEffect, type ReactNode } from "react";
import { ActivityIndicator, Platform, RefreshControl, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { useRouter, type Href } from "expo-router";
import { FONT_FAMILY } from "../theme/tokens";
import { useAppTheme } from "../theme/use-app-theme";
import { useTabBarClearance } from "../hooks/use-tab-bar-clearance";
import { haptics } from "../lib/haptics";
import { WorkspaceContentMotionProvider, SoftPressable, SOFT_MOTION, useWorkspaceReducedMotion, WorkspaceAtmosphere } from "./workspace-motion";
import { HomeBrand } from "./home-brand";

export function GlassSurface({ children, style, onPress, accessibilityLabel, strong = false }: {
  children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; accessibilityLabel?: string; strong?: boolean;
}) {
  const { isDark, workspace } = useAppTheme();
  const surfaceBg = Platform.OS === "android"
    ? (strong ? workspace.glassStrongAndroid : workspace.glassAndroid)
    : (strong ? workspace.glassStrong : workspace.glass);
  const surfaceStyle = [
    styles.glass,
    { borderColor: workspace.line },
    !isDark && styles.lightElevation,
    style,
  ];
  const content = <>
    {Platform.OS !== "android" && <BlurView intensity={32} tint={workspace.blurTint} pointerEvents="none" style={StyleSheet.absoluteFill} />}
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: surfaceBg }]} />
    <View pointerEvents="none" style={[styles.reflection, { backgroundColor: workspace.shine }]} />{children}
  </>;
  return onPress ? <SoftPressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={() => { haptics.tap(); onPress(); }}
    style={surfaceStyle}>{content}</SoftPressable> : <View style={surfaceStyle}>{content}</View>;
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

export function PageHeader({ label, back = false, backFallback = "/(tabs)/home", children }: { label: string; back?: boolean; backFallback?: Href; children?: ReactNode }) {
  const router = useRouter();
  const { workspace, ui } = useAppTheme();
  return <View style={styles.header}>
    {back ? <SoftPressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={() => { haptics.tap(); if (router.canGoBack()) router.back(); else router.replace(backFallback); }} style={[styles.iconButton, { borderColor: workspace.line, backgroundColor: workspace.neutralTint }]}>
      <Ionicons name="arrow-back" size={22} color={workspace.text} /></SoftPressable>
      : <HomeBrand />}
    <Text style={[ui.eyebrow, styles.headerLabel, { color: workspace.secondary }, !back && styles.brandLabel]}>{label}</Text>{children ?? (back ? <View style={[styles.headerDot, { backgroundColor: workspace.muted }]} /> : null)}
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
  const highlight = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], ["rgba(124,58,237,0)", workspace.chipActiveBg]),
    opacity: progress.value,
  }));
  return <SoftPressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected }} onPress={() => { haptics.tap(); onPress(); }}
    style={[styles.chip, { borderColor: workspace.line, backgroundColor: workspace.chipBg }, tab && styles.tabChip]}>
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.chipActive, { borderColor: workspace.chipActiveBorder }, highlight]} />
    <Text style={[styles.chipText, { color: workspace.muted }, tab && styles.tabChipText, selected && { color: workspace.text }]}>{label}</Text>
  </SoftPressable>;
}

export function ActionButton({ label, onPress, disabled = false, danger = false, icon = "refresh-outline" }: {
  label: string; onPress: () => void; disabled?: boolean; danger?: boolean; icon?: keyof typeof Ionicons.glyphMap;
}) {
  const { workspace } = useAppTheme();
  const tintColor = danger ? workspace.dangerInk : workspace.lavender;
  return <SoftPressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={() => { haptics.tap(); onPress(); }}
    style={[
      styles.action,
      {
        borderColor: danger ? workspace.dangerActionBorder : workspace.actionBorder,
        backgroundColor: danger ? workspace.dangerActionBg : workspace.actionBg,
      },
    ]}>
    <Ionicons name={icon} size={18} color={tintColor} /><Text style={[styles.actionText, { color: tintColor }]}>{label}</Text>
  </SoftPressable>;
}

export function DataState({ title, message, loading = false, error = false, onRetry }: {
  title: string; message?: string; loading?: boolean; error?: boolean; onRetry?: () => void;
}) {
  const { workspace, ui } = useAppTheme();
  return <GlassSurface style={styles.state}>
    <View style={[styles.stateIcon, { backgroundColor: error ? workspace.dangerActionBg : workspace.neutralTint }]}>
      {loading ? <ActivityIndicator color={workspace.lavender} /> : <Ionicons name={error ? "cloud-offline-outline" : "layers-outline"} size={25} color={error ? workspace.dangerInk : workspace.secondary} />}
    </View><Text accessibilityRole="header" style={[ui.heading, { fontSize: 17, textAlign: "center" }]}>{title}</Text>
    {message && <Text accessibilityLiveRegion={error ? "polite" : "none"} style={[ui.muted, { textAlign: "center" }]}>{message}</Text>}
    {onRetry && <ActionButton label="Tentar novamente" onPress={onRetry} />}
  </GlassSurface>;
}

export function DetailField({ label, value }: { label: string; value: string }) {
  const { ui } = useAppTheme();
  return <View style={{ gap: 6 }}><Text style={ui.eyebrow}>{label}</Text><Text style={ui.body}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, overflow: "hidden" }, flex: { flex: 1 }, content: { paddingHorizontal: 20, gap: 20 },
  glass: { borderRadius: 24, borderWidth: 1, overflow: "hidden", padding: 20, gap: 16 },
  lightElevation: { shadowColor: "#181a20", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 2 },
  reflection: { position: "absolute", top: 0, left: 22, right: 22, height: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 64, paddingVertical: 8 }, headerLabel: { flex: 1, letterSpacing: 0.8 },
  brandLabel: { textAlign: "right", flexShrink: 1 },
  headerDot: { width: 6, height: 6, borderRadius: 3, marginRight: 8 },
  iconButton: { width: 48, height: 48, alignItems: "center", justifyContent: "center", borderRadius: 18, borderWidth: 1 },
  chip: { minHeight: 48, minWidth: 48, paddingHorizontal: 16, paddingVertical: 10, flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 18, overflow: "hidden" },
  chipActive: { borderRadius: 17, borderWidth: 1 }, chipText: { fontFamily: FONT_FAMILY.medium, fontSize: 14 },
  tabChip: { flex: 1, minWidth: 0, paddingHorizontal: 8, justifyContent: "center" }, tabChipText: { fontSize: 13, textAlign: "center", flexShrink: 1 },
  action: { minHeight: 48, paddingHorizontal: 18, paddingVertical: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, borderRadius: 16, borderWidth: 1 },
  actionText: { fontFamily: FONT_FAMILY.medium, fontSize: 14, flexShrink: 1, textAlign: "center" },
  state: { alignItems: "center", paddingVertical: 32, gap: 14 }, stateIcon: { width: 52, height: 52, borderRadius: 18, alignItems: "center", justifyContent: "center" },
});
