/**
 * Material da barra inferior. Detecta o vidro nativo sem exigir que a build
 * tenha o módulo e respeita a redução de transparência no iOS.
 * Consumidor: a cápsula compartilhada pelas telas autenticadas.
 */
import { useEffect, useState, type ReactNode } from "react";
import { AccessibilityInfo, Platform, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { requireOptionalNativeModule } from "expo";
import { useAppTheme } from "../theme/use-app-theme";
import { TAB_BAR } from "../theme/tokens";
import { useWorkspaceReducedMotion } from "./workspace-motion";

type NativeGlassView = typeof import("expo-glass-effect").GlassView;

export function TabBarMaterial({ children, style }: { children: ReactNode; style: StyleProp<ViewStyle> }) {
  const { colors, workspace } = useAppTheme();
  const reducedMotion = useWorkspaceReducedMotion();
  const [GlassView, setGlassView] = useState<NativeGlassView | null>(null);
  const [allowsTransparency, setAllowsTransparency] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "ios" || !requireOptionalNativeModule("ExpoGlassEffect")) return;

    let active = true;
    let preferenceChanged = false;
    const subscription = AccessibilityInfo.addEventListener("reduceTransparencyChanged", (reduced) => {
      preferenceChanged = true;
      setAllowsTransparency(!reduced);
    });
    void AccessibilityInfo.isReduceTransparencyEnabled().then((reduced) => {
      if (active && !preferenceChanged) setAllowsTransparency(!reduced);
    }).catch(() => {});

    // Carrega o componente só quando o binário anuncia o módulo nativo.
    void import("expo-glass-effect").then((glass) => {
      if (active && glass.isGlassEffectAPIAvailable() && glass.isLiquidGlassAvailable()) {
        setGlassView(() => glass.GlassView);
      }
    }).catch(() => {});

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  if (GlassView && allowsTransparency) {
    return <GlassView testID="tab-bar-native-glass" glassEffectStyle="regular" colorScheme="dark"
      isInteractive={!reducedMotion} style={style}>{children}</GlassView>;
  }

  return <View testID="tab-bar-solid-surface" style={[style, { backgroundColor: workspace.tabSurface }]}>
    <View pointerEvents="none" style={[styles.solidBorder, { borderColor: colors.borderDefault }]} />
    {children}
  </View>;
}

const styles = StyleSheet.create({
  solidBorder: { ...StyleSheet.absoluteFill, borderRadius: TAB_BAR.height / 2, borderWidth: 1 },
});
