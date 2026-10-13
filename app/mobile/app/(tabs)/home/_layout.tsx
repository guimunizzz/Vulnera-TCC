/**
 * Stack aninhado dentro da aba "Projetos": lista → detalhe do projeto →
 * detalhe do finding, cada nível com botão "voltar" nativo. A barra de abas
 * de baixo continua visível em todo o fluxo (comportamento padrão de stack
 * dentro de tab do Expo Router) — só o header de cima muda.
 */

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
        animation: reduced ? "none" : "slide_from_right",
        animationDuration: 280,
        gestureEnabled: true,
        fullScreenGestureEnabled: true,
      }}
    >
      <Stack.Screen name="index" options={{ title: "Meus projetos" }} />
      <Stack.Screen name="project/[id]" options={{ title: "Projeto" }} />
      <Stack.Screen name="finding/[id]" options={{ title: "Finding" }} />
    </Stack>
  );
}
