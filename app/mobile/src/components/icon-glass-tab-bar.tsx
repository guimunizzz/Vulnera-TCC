/**
 * Barra glass compacta do modelo 7: ícones e seleção deslizante adaptados
 * aos temas escuro e claro. Segue a aba realmente aberta para manter clique,
 * deep link e retorno alinhados.
 * Consumidor: layout autenticado do mobile, preservando os eventos de navegação.
 */
import { memo, useEffect, type ComponentProps } from "react";
import { Platform, StyleSheet, View } from "react-native";
import type { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { SHADOW, TAB_BAR } from "../theme/tokens";
import { useAppTheme } from "../theme/use-app-theme";
import { SOFT_MOTION, SoftPressable, useWorkspaceReducedMotion } from "./workspace-motion";

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];
const EDGE = 8;
const INDICATOR_WIDTH = 24;
export const TAB_TRANSITION_DURATION = 190;

type TabGlyph = "folder-outline" | "document-text-outline" | "settings-outline";

const NavigationIcon = memo(function NavigationIcon({
  name,
  focused,
  idleColor,
  activeColor,
}: {
  name: TabGlyph;
  focused: boolean;
  idleColor: string;
  activeColor: string;
}) {
  const reduced = useWorkspaceReducedMotion();
  const progress = useSharedValue(focused ? 1 : 0);
  useEffect(() => {
    progress.value = withTiming(focused ? 1 : 0, { ...SOFT_MOTION, duration: reduced ? 0 : TAB_TRANSITION_DURATION });
    return () => cancelAnimation(progress);
  }, [focused, reduced, progress]);
  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: reduced ? 1 : 1 + progress.value * 0.1 }],
  }));
  const idle = useAnimatedStyle(() => ({ opacity: 1 - progress.value }));
  const active = useAnimatedStyle(() => ({ opacity: progress.value }));
  return (
    <Animated.View
      testID={`tab-icon-${name}`}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.icon, animated]}
    >
      <Animated.View style={[styles.iconLayer, idle]}>
        <Ionicons name={name} size={24} color={idleColor} accessible={false} />
      </Animated.View>
      <Animated.View style={[styles.iconLayer, active]}>
        <Ionicons name={name} size={24} color={activeColor} accessible={false} />
      </Animated.View>
    </Animated.View>
  );
});

export const IconGlassTabBar = memo(function IconGlassTabBar({ state, descriptors, emitter, navigateToTab }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const reduced = useWorkspaceReducedMotion();
  const { isDark, workspace } = useAppTheme();
  const routes = state.routes.filter(
    (route) => route.name === "home" || route.name === "reports" || route.name === "settings",
  );
  const count = Math.max(1, routes.length);
  const barWidth = count >= 3 ? 240 : TAB_BAR.width;
  const cellWidth = (barWidth - EDGE * 2 - 2) / count;
  const currentKey = state.routes[state.index]?.key;
  const selected = Math.max(0, routes.findIndex((route) => route.key === currentKey));
  const position = useSharedValue(selected);
  useEffect(() => {
    position.value = withTiming(selected, { ...SOFT_MOTION, duration: reduced ? 0 : TAB_TRANSITION_DURATION });
    return () => cancelAnimation(position);
  }, [selected, reduced, position]);
  const indicator = useAnimatedStyle(() => ({ transform: [{ translateX: position.value * cellWidth }] }));

  const iconFor = (name: string): TabGlyph =>
    name === "home" ? "folder-outline" : name === "reports" ? "document-text-outline" : "settings-outline";
  const defaultTitle = (name: string): string =>
    name === "home" ? "Projetos" : name === "reports" ? "Relatórios" : "Minha conta";

  return (
    <View
      pointerEvents="box-none"
      style={[styles.anchor, { left: insets.left, right: insets.right, bottom: insets.bottom + TAB_BAR.bottomMargin }]}
    >
      <View
        testID="icon-glass-tab-bar"
        style={[
          styles.outer,
          { width: barWidth },
          isDark ? SHADOW.raised : styles.lightShadow,
        ]}
      >
        <View style={[styles.glass, { borderColor: workspace.tabBorder }]}>
          {Platform.OS !== "android" && (
            <BlurView intensity={45} tint={workspace.blurTint} pointerEvents="none" style={StyleSheet.absoluteFill} />
          )}
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: Platform.OS === "android" ? workspace.tabGlassAndroid : workspace.tabGlass },
            ]}
          />
          <View pointerEvents="none" style={[styles.reflection, { backgroundColor: workspace.shine }]} />
          {Array.from({ length: Math.max(0, count - 1) }).map((_, idx) => (
            <View
              key={idx}
              pointerEvents="none"
              style={[styles.divider, { left: EDGE + cellWidth * (idx + 1), backgroundColor: workspace.line }]}
            />
          ))}
          <Animated.View
            testID="tab-selection-indicator"
            pointerEvents="none"
            style={[
              styles.indicator,
              {
                left: EDGE + (cellWidth - INDICATOR_WIDTH) / 2,
                backgroundColor: workspace.lavender,
              },
              indicator,
            ]}
          />
          {routes.map((route) => {
            const focused = route.key === currentKey;
            const options = descriptors[route.key]?.options;
            const title = options?.tabBarAccessibilityLabel ?? options?.title ?? defaultTitle(route.name);
            return (
              <SoftPressable
                key={route.key}
                accessibilityRole="tab"
                accessibilityLabel={title}
                accessibilityState={{ selected: focused }}
                aria-selected={focused}
                testID={`navigation-${route.name}`}
                style={[styles.button, { width: cellWidth }]}
                onPress={() => {
                  const event = emitter.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
                  if (!focused && !event.defaultPrevented) navigateToTab(route.key);
                }}
                onLongPress={() => {
                  emitter.emit({ type: "tabLongPress", target: route.key });
                }}
              >
                <NavigationIcon
                  name={iconFor(route.name)}
                  focused={focused}
                  idleColor={workspace.muted}
                  activeColor={workspace.lavender}
                />
              </SoftPressable>
            );
          })}
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  anchor: { position: "absolute", alignItems: "center", height: TAB_BAR.height },
  outer: { height: TAB_BAR.height, borderRadius: TAB_BAR.height / 2 },
  lightShadow: {
    shadowColor: "#181a20",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 6,
  },
  glass: {
    flex: 1,
    flexDirection: "row",
    paddingHorizontal: EDGE,
    borderRadius: TAB_BAR.height / 2,
    borderWidth: 1,
    overflow: "hidden",
  },
  reflection: { position: "absolute", top: 0, left: 20, right: 20, height: 1 },
  divider: { position: "absolute", width: 1, height: 20, top: 17 },
  button: { minHeight: 48, alignItems: "center", justifyContent: "center", paddingBottom: 3 },
  icon: { width: 32, height: 32 },
  iconLayer: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  indicator: {
    position: "absolute",
    bottom: 6,
    width: INDICATOR_WIDTH,
    height: 3,
    borderRadius: 2,
  },
});
