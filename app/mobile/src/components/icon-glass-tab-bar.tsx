/**
 * Barra inferior com ícones e seleção deslizante nos temas escuro e claro.
 * Segue a aba realmente aberta para manter clique,
 * deep link e retorno alinhados.
 * Consumidor: layout autenticado do mobile, preservando os eventos de navegação.
 */
import { memo, useEffect, type ComponentProps } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import type { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { FONT_FAMILY, TAB_BAR } from "../theme/tokens";
import { useAppTheme } from "../theme/use-app-theme";
import { SELECTION_MOTION, SoftPressable, useWorkspaceReducedMotion } from "./workspace-motion";
import { TabBarMaterial } from "./tab-bar-material";

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];
const EDGE = 8;
const INDICATOR_WIDTH = 24;
export const TAB_TRANSITION_DURATION = SELECTION_MOTION.duration;

type TabGlyph = "grid-outline" | "folder-outline" | "shield-outline" | "document-text-outline";

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
    progress.value = reduced ? Number(focused) : withTiming(Number(focused), SELECTION_MOTION);
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
  const { width } = useWindowDimensions();
  const reduced = useWorkspaceReducedMotion();
  const { workspace } = useAppTheme();
  const routes = state.routes.filter(
    (route) => route.name === "dashboard" || route.name === "home" || route.name === "security" || route.name === "reports",
  );
  const count = Math.max(1, routes.length);
  const barWidth = Math.min(count >= 3 ? 304 : TAB_BAR.width, width - insets.left - insets.right - 24);
  const cellWidth = (barWidth - EDGE * 2) / count;
  const currentKey = state.routes[state.index]?.key;
  const selected = routes.findIndex((route) => route.key === currentKey);
  const position = useSharedValue(selected);
  useEffect(() => {
    if (selected >= 0) position.value = reduced ? selected : withTiming(selected, SELECTION_MOTION);
    return () => cancelAnimation(position);
  }, [selected, reduced, position]);
  const indicator = useAnimatedStyle(() => ({ transform: [{ translateX: position.value * cellWidth }] }));

  const iconFor = (name: string): TabGlyph =>
    name === "dashboard" ? "grid-outline" : name === "home" ? "folder-outline" : name === "security" ? "shield-outline" : "document-text-outline";
  const defaultTitle = (name: string): string =>
    name === "dashboard" ? "Painel" : name === "home" ? "Projetos" : name === "security" ? "Segurança" : "Relatórios";

  return (
    <View
      pointerEvents="box-none"
      style={[styles.anchor, { left: insets.left, right: insets.right, bottom: insets.bottom + TAB_BAR.bottomMargin }]}
    >
      <View testID="icon-glass-tab-bar" style={[styles.outer, { width: barWidth }]}>
        <TabBarMaterial style={styles.material}>
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
              selected < 0 && { opacity: 0 },
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
                <Text accessible={false} numberOfLines={1} maxFontSizeMultiplier={1.45}
                  style={[styles.label, { color: focused ? workspace.lavender : workspace.muted }]}>{title}</Text>
              </SoftPressable>
            );
          })}
        </TabBarMaterial>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  anchor: { position: "absolute", alignItems: "center", height: TAB_BAR.height },
  outer: { height: TAB_BAR.height },
  material: {
    flex: 1,
    flexDirection: "row",
    paddingHorizontal: EDGE,
    borderRadius: TAB_BAR.height / 2,
  },
  button: { alignItems: "center", justifyContent: "center", paddingBottom: 4 },
  icon: { width: 26, height: 26 },
  label: { fontFamily: FONT_FAMILY.medium, fontSize: 10, lineHeight: 14, textAlign: "center" },
  iconLayer: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  indicator: {
    position: "absolute",
    bottom: 2,
    width: INDICATOR_WIDTH,
    height: 3,
    borderRadius: 2,
  },
});
