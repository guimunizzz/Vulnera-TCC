/**
 * Stack aninhado dentro da aba "Projetos": lista → detalhe do projeto →
 * detalhe da vulnerabilidade, mantendo a barra de abas e o retorno do cabeçalho.
 * O navegador nativo conduz o deslize e o gesto de retorno sem fades empilhados.
 * Prioriza fluidez no aparelho; o conteúdo já monta com layout estável.
 */

import { Platform } from "react-native";
import { Stack } from "expo-router";
import { COLORS } from "../../../src/theme/tokens";
import { WORKSPACE } from "../../../src/theme/workspace";
import { useWorkspaceReducedMotion } from "../../../src/components/workspace-motion";

export default function HomeStackLayout() {
  const reduced = useWorkspaceReducedMotion();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        headerStyle: { backgroundColor: COLORS.surface },
        headerTintColor: COLORS.textPrimary,
        headerShadowVisible: false,
        headerBackTitle: "Voltar",
        contentStyle: { backgroundColor: WORKSPACE.background },
        animation: reduced ? "none" : Platform.OS === "ios" ? "simple_push" : "slide_from_right",
        animationDuration: reduced ? 0 : 320,
        gestureEnabled: !reduced,
        gestureDirection: "horizontal",
      }}
    >
      <Stack.Screen name="index" options={{ title: "Meus projetos" }} />
      <Stack.Screen name="project/[id]" options={{ title: "Projeto" }} />
      <Stack.Screen name="finding/[id]" options={{ title: "Vulnerabilidade" }} />
    </Stack>
  );
}
