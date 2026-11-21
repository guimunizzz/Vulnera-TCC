/** Pilha do Painel. Mantém o achado prioritário na mesma aba para que Voltar retorne à lista. */
import { Stack } from "expo-router";
import { Platform } from "react-native";
import { useWorkspaceReducedMotion } from "../../../src/components/workspace-motion";
import { useAppTheme } from "../../../src/theme/use-app-theme";

export const unstable_settings = { initialRouteName: "index" };

export default function DashboardLayout() {
  const { workspace } = useAppTheme();
  const reduced = useWorkspaceReducedMotion();
  return <Stack screenOptions={{
    headerShown: false,
    contentStyle: { backgroundColor: workspace.background },
    animation: reduced ? "none" : Platform.OS === "ios" ? "simple_push" : "slide_from_right",
    animationDuration: reduced ? 0 : 320,
    gestureEnabled: !reduced,
  }}>
    <Stack.Screen name="index" options={{ title: "Painel" }} />
    <Stack.Screen name="finding/[id]" options={{ title: "Vulnerabilidade" }} />
  </Stack>;
}
