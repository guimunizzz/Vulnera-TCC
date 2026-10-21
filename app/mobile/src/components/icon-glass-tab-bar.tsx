/**
 * Barra glass compacta do modelo 7: dois ícones e seleção deslizante.
 * Segue a aba realmente aberta para manter clique, deep link e retorno alinhados.
 * Consumidor: layout autenticado do mobile, preservando os eventos de navegação.
 */
import { useEffect, type ComponentProps } from "react";
import { StyleSheet, View } from "react-native";
import type { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { SHADOW, TAB_BAR } from "../theme/tokens";
import { WORKSPACE } from "../theme/workspace";
import { SOFT_MOTION, SoftPressable, useWorkspaceReducedMotion } from "./workspace-motion";
import { useActiveWorkspaceBlur } from "./workspace-blur";

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];
const EDGE = 8;
const INDICATOR_WIDTH = 24;
const CELL_WIDTH = (TAB_BAR.width - EDGE * 2 - 2) / 2;
export const TAB_TRANSITION_DURATION = 320;

function NavigationIcon({ name, focused }: { name: "folder-outline" | "settings-outline"; focused: boolean }) {
  const reduced = useWorkspaceReducedMotion();
  const progress = useSharedValue(focused ? 1 : 0);
  useEffect(() => {
    progress.value = withTiming(focused ? 1 : 0, { ...SOFT_MOTION, duration: reduced ? 0 : TAB_TRANSITION_DURATION });
    return () => cancelAnimation(progress);
  }, [focused, reduced, progress]);
  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: reduced ? 1 : 1 + progress.value * 0.1 }],
  }));
  // Animar camadas evita setNativeProps do ícone, incompatível com o preview web.
  const idle = useAnimatedStyle(() => ({ opacity: 1 - progress.value }));
  const active = useAnimatedStyle(() => ({ opacity: progress.value }));
  return <Animated.View testID={`tab-icon-${name}`} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.icon, animated]}>
    <Animated.View style={[styles.iconLayer, idle]}><Ionicons name={name} size={24} color={WORKSPACE.muted} accessible={false} /></Animated.View>
    <Animated.View style={[styles.iconLayer, active]}><Ionicons name={name} size={24} color={WORKSPACE.lavender} accessible={false} /></Animated.View>
  </Animated.View>;
}

export function IconGlassTabBar({ state, descriptors, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const reduced = useWorkspaceReducedMotion();
  const { target: blurTarget } = useActiveWorkspaceBlur();
  const routes = state.routes.filter((route) => route.name === "home" || route.name === "settings");
  const currentKey = state.routes[state.index]?.key;
  const selected = Math.max(0, routes.findIndex((route) => route.key === currentKey));
  const position = useSharedValue(selected);
  useEffect(() => {
    position.value = withTiming(selected, { ...SOFT_MOTION, duration: reduced ? 0 : TAB_TRANSITION_DURATION });
    return () => cancelAnimation(position);
  }, [selected, reduced, position]);
  const indicator = useAnimatedStyle(() => ({ transform: [{ translateX: position.value * CELL_WIDTH }] }));

  return <View pointerEvents="box-none" style={[styles.anchor, { left: insets.left, right: insets.right, bottom: insets.bottom + TAB_BAR.bottomMargin }]}>
    <View testID="icon-glass-tab-bar" style={[styles.outer, SHADOW.raised]}>
      <View style={styles.glass}>
        <BlurView intensity={45} tint="dark" blurTarget={blurTarget} blurMethod={blurTarget ? "dimezisBlurViewSdk31Plus" : "none"}
          pointerEvents="none" style={StyleSheet.absoluteFill} />
        <View pointerEvents="none" style={styles.tint} />
        <View pointerEvents="none" style={styles.reflection} />
        <View pointerEvents="none" style={styles.divider} />
        <Animated.View testID="tab-selection-indicator" pointerEvents="none" style={[styles.indicator, indicator]} />
        {routes.map((route) => {
          const focused = route.key === currentKey;
          const options = descriptors[route.key].options;
          const title = options.tabBarAccessibilityLabel ?? options.title ?? (route.name === "home" ? "Projetos" : "Minha conta");
          return <SoftPressable key={route.key} accessibilityRole="tab" accessibilityLabel={title}
            accessibilityState={{ selected: focused }} aria-selected={focused} testID={`navigation-${route.name}`} style={styles.button}
            onPress={() => {
              const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
            }}
            onLongPress={() => { navigation.emit({ type: "tabLongPress", target: route.key }); }}>
            <NavigationIcon name={route.name === "home" ? "folder-outline" : "settings-outline"} focused={focused} />
          </SoftPressable>;
        })}
      </View>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  anchor: { position: "absolute", alignItems: "center", height: TAB_BAR.height },
  outer: { width: TAB_BAR.width, height: TAB_BAR.height, borderRadius: TAB_BAR.height / 2 },
  glass: { flex: 1, flexDirection: "row", paddingHorizontal: EDGE, borderRadius: TAB_BAR.height / 2, borderWidth: 1,
    borderColor: "rgba(255,255,255,0.17)", overflow: "hidden" },
  tint: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(29,31,36,0.64)" },
  reflection: { position: "absolute", top: 0, left: 20, right: 20, height: 1, backgroundColor: "rgba(255,255,255,0.24)" },
  divider: { position: "absolute", width: 1, height: 20, left: (TAB_BAR.width - 2) / 2, top: 14, backgroundColor: WORKSPACE.line },
  button: { width: CELL_WIDTH, minHeight: 48, alignItems: "center", justifyContent: "center", paddingBottom: 3 },
  icon: { width: 32, height: 32 }, iconLayer: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  indicator: { position: "absolute", left: EDGE + (CELL_WIDTH - INDICATOR_WIDTH) / 2, bottom: 6,
    width: INDICATOR_WIDTH, height: 3, borderRadius: 2, backgroundColor: WORKSPACE.lavender },
});
