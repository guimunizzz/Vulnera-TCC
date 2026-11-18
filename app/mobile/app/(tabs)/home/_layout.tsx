/**
 * Stack aninhado dentro da aba "Projetos": lista → detalhe do projeto →
 * detalhe da vulnerabilidade, mantendo a barra de abas e o retorno do cabeçalho.
 */

import { Platform } from "react-native";
import { Stack } from "expo-router";
import { useAppTheme } from "../../../src/theme/use-app-theme";
import { useWorkspaceReducedMotion } from "../../../src/components/workspace-motion";

export default function HomeStackLayout() {
  const { colors, workspace } = useAppTheme();
  const reduced = useWorkspaceReducedMotion();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.textPrimary,
        headerShadowVisible: false,
        headerBackTitle: "Voltar",
        contentStyle: { backgroundColor: workspace.background },
        animation: reduced ? "none" : Platform.OS === "ios" ? "simple_push" : "slide_from_right",
        animationDuration: reduced ? 0 : 320,
        gestureEnabled: !reduced,
        gestureDirection: "horizontal",
      }}
    >
      <Stack.Screen name="index" options={{ title: "Meus projetos" }} />
      <Stack.Screen name="exposure" options={{ title: "Exposure Graph" }} />
      <Stack.Screen name="project/[id]" options={{ title: "Projeto" }} />
      <Stack.Screen name="finding/[id]" options={{ title: "Vulnerabilidade" }} />
    </Stack>
  );
}
