/**
 * Superfícies liquid glass e estrutura das telas autenticadas.
 * Unifica navegação, contraste e estados de dados sem alterar o login.
 * Consumidores: Home, detalhes de projeto/finding e Configurações.
 */
import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { ActivityIndicator, RefreshControl, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { BlurTargetView, BlurView } from "expo-blur";
import { useFocusEffect, useRouter } from "expo-router";
import { FONT_FAMILY } from "../theme/tokens";
import { WORKSPACE, workspaceStyles as ui } from "../theme/workspace";
import { useTabBarClearance } from "../hooks/use-tab-bar-clearance";
import { haptics } from "../lib/haptics";
import { MotionReveal, SoftPressable, SOFT_MOTION, useWorkspaceReducedMotion, useWorkspaceScroll, WorkspaceAtmosphere } from "./workspace-motion";
import { ScreenBlurTargetContext, useActiveWorkspaceBlur, useScreenBlurTarget } from "./workspace-blur";

export function GlassSurface({ children, style, onPress, accessibilityLabel, strong = false }: {
  children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; accessibilityLabel?: string; strong?: boolean;
}) {
  const blurTarget = useScreenBlurTarget();
  const content = <>
    <BlurView intensity={32} tint="dark" blurTarget={blurTarget} blurMethod={blurTarget ? "dimezisBlurViewSdk31Plus" : "none"} pointerEvents="none" style={StyleSheet.absoluteFill} />
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: strong ? WORKSPACE.glassStrong : WORKSPACE.glass }]} />
    <View pointerEvents="none" style={styles.reflection} />{children}
  </>;
  return onPress ? <SoftPressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={() => { haptics.tap(); onPress(); }}
    style={[styles.glass, style]}>{content}</SoftPressable> : <View style={[styles.glass, style]}>{content}</View>;
}

export function WorkspaceScreen({ children, scroll = true, refreshing = false, onRefresh, scrollY }: {
  children: ReactNode; scroll?: boolean; refreshing?: boolean; onRefresh?: () => void; scrollY?: SharedValue<number>;
}) {
  const bottom = useTabBarClearance();
  const internalScroll = useWorkspaceScroll();
  const blurTarget = useRef<View | null>(null);
  const { activate, deactivate } = useActiveWorkspaceBlur();
  useFocusEffect(useCallback(() => { activate(blurTarget); return () => deactivate(blurTarget); }, [activate, deactivate]));
  return <ScreenBlurTargetContext.Provider value={blurTarget}><SafeAreaView edges={["top", "left", "right"]} style={styles.screen}>
    <BlurTargetView ref={blurTarget} pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: WORKSPACE.background }]} collapsable={false}>
      <WorkspaceAtmosphere scrollY={scrollY ?? internalScroll.scrollY} />
    </BlurTargetView>
    {scroll ? <Animated.ScrollView onScroll={internalScroll.onScroll} scrollEventThrottle={16} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: bottom + 16 }}
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={WORKSPACE.lavender} colors={[WORKSPACE.purple]} /> : undefined}>
      <MotionReveal style={styles.content}>{children}</MotionReveal></Animated.ScrollView> : <MotionReveal style={styles.flex}>{children}</MotionReveal>}
  </SafeAreaView></ScreenBlurTargetContext.Provider>;
}

export function PageHeader({ label, back = false, children }: { label: string; back?: boolean; children?: ReactNode }) {
  const router = useRouter();
  return <View style={styles.header}>
    {back ? <SoftPressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={() => { haptics.tap(); if (router.canGoBack()) router.back(); else router.replace("/(tabs)/home"); }} style={styles.iconButton}>
      <Ionicons name="arrow-back" size={22} color={WORKSPACE.text} /></SoftPressable>
      : <View style={styles.brandIcon}><Ionicons name="shield-half-outline" size={22} color={WORKSPACE.lavender} /></View>}
    <Text style={[ui.eyebrow, styles.headerLabel]}>{label}</Text>{children ?? <View style={styles.headerDot} />}
  </View>;
}

export function SectionHeading({ title, meta }: { title: string; meta?: string }) {
  return <View style={ui.spread}><Text accessibilityRole="header" style={ui.heading}>{title}</Text>{meta && <Text style={ui.mono}>{meta}</Text>}</View>;
}

export function FilterChip({ label, selected, onPress, tab = false }: { label: string; selected: boolean; onPress: () => void; tab?: boolean }) {
  const reduced = useWorkspaceReducedMotion();
  const progress = useSharedValue(selected ? 1 : 0);
  useEffect(() => { progress.value = withTiming(selected ? 1 : 0, { ...SOFT_MOTION, duration: reduced ? 0 : 220 }); }, [selected, reduced, progress]);
  const highlight = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(progress.value, [0, 1], ["rgba(124,58,237,0)", "rgba(124,58,237,0.20)"]), opacity: progress.value }));
  return <SoftPressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected }} onPress={() => { haptics.tap(); onPress(); }}
    style={[styles.chip, tab && styles.tabChip]}><Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.chipActive, highlight]} /><Text style={[styles.chipText, tab && styles.tabChipText, selected && { color: WORKSPACE.text }]}>{label}</Text></SoftPressable>;
}

export function ActionButton({ label, onPress, disabled = false, danger = false, icon = "refresh-outline" }: {
  label: string; onPress: () => void; disabled?: boolean; danger?: boolean; icon?: keyof typeof Ionicons.glyphMap;
}) {
  return <SoftPressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={() => { haptics.tap(); onPress(); }}
    style={[styles.action, danger && styles.dangerAction]}>
    <Ionicons name={icon} size={18} color={danger ? "#fda4af" : WORKSPACE.lavender} /><Text style={[styles.actionText, danger && { color: "#fda4af" }]}>{label}</Text>
  </SoftPressable>;
}

export function DataState({ title, message, loading = false, error = false, onRetry }: {
  title: string; message?: string; loading?: boolean; error?: boolean; onRetry?: () => void;
}) {
  return <GlassSurface style={styles.state}>
    <View style={[styles.stateIcon, error && { backgroundColor: "rgba(225,29,72,0.12)" }]}>
      {loading ? <ActivityIndicator color={WORKSPACE.lavender} /> : <Ionicons name={error ? "cloud-offline-outline" : "layers-outline"} size={25} color={error ? "#fda4af" : WORKSPACE.secondary} />}
    </View><Text accessibilityRole="header" style={[ui.heading, { fontSize: 17, textAlign: "center" }]}>{title}</Text>
    {message && <Text accessibilityLiveRegion={error ? "polite" : "none"} style={[ui.muted, { textAlign: "center" }]}>{message}</Text>}
    {onRetry && <ActionButton label="Tentar novamente" onPress={onRetry} />}
  </GlassSurface>;
}

export function DetailField({ label, value }: { label: string; value: string }) {
  return <View style={{ gap: 6 }}><Text style={ui.eyebrow}>{label}</Text><Text style={ui.body}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: WORKSPACE.background, overflow: "hidden" }, flex: { flex: 1 }, content: { paddingHorizontal: 20, gap: 20 },
  glass: { borderRadius: WORKSPACE.radius, borderWidth: 1, borderColor: WORKSPACE.line, overflow: "hidden", padding: 20, gap: 16 },
  reflection: { position: "absolute", top: 0, left: 22, right: 22, height: 1, backgroundColor: WORKSPACE.shine },
  header: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 64, paddingVertical: 8 }, headerLabel: { flex: 1, color: WORKSPACE.secondary, letterSpacing: 0.8 },
  brandIcon: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 14, borderWidth: 1, borderColor: WORKSPACE.line, backgroundColor: "rgba(124,58,237,0.10)" },
  headerDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: WORKSPACE.muted, marginRight: 8 },
  iconButton: { width: 48, height: 48, alignItems: "center", justifyContent: "center", borderRadius: 18, borderWidth: 1, borderColor: WORKSPACE.line, backgroundColor: "rgba(255,255,255,0.035)" },
  chip: { minHeight: 48, minWidth: 48, paddingHorizontal: 16, paddingVertical: 10, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: WORKSPACE.line, borderRadius: 18, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.025)" },
  chipActive: { borderRadius: 17, borderWidth: 1, borderColor: "rgba(167,139,250,0.24)" }, chipText: { fontFamily: FONT_FAMILY.medium, fontSize: 14, color: WORKSPACE.muted },
  tabChip: { flex: 1, minWidth: 0, paddingHorizontal: 8, justifyContent: "center" }, tabChipText: { fontSize: 13, textAlign: "center", flexShrink: 1 },
  action: { minHeight: 48, paddingHorizontal: 18, paddingVertical: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, borderRadius: 16, borderWidth: 1, borderColor: "rgba(167,139,250,0.25)", backgroundColor: "rgba(124,58,237,0.12)" },
  actionText: { fontFamily: FONT_FAMILY.medium, fontSize: 14, color: WORKSPACE.lavender, flexShrink: 1, textAlign: "center" }, dangerAction: { borderColor: "rgba(253,164,175,0.18)", backgroundColor: "rgba(225,29,72,0.06)" },
  state: { alignItems: "center", paddingVertical: 32, gap: 14 }, stateIcon: { width: 52, height: 52, borderRadius: 18, backgroundColor: WORKSPACE.neutralTint, alignItems: "center", justifyContent: "center" },
});
