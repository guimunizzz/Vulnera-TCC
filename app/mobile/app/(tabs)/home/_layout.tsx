/**
 * Stack aninhado dentro da aba "Projetos": lista → detalhe do projeto →
 * detalhe do finding, cada nível com botão "voltar" nativo. A barra de abas
 * de baixo continua visível em todo o fluxo (comportamento padrão de stack
 * dentro de tab do Expo Router) — só o header de cima muda.
 */

import { Stack } from "expo-router";
import { COLORS } from "../../../src/theme/tokens";

export default function HomeStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.surface },
        headerTintColor: COLORS.textPrimary,
        headerShadowVisible: false,
        headerBackTitle: "Voltar",
        contentStyle: { backgroundColor: COLORS.canvas },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Meus projetos" }} />
      <Stack.Screen name="project/[id]" options={{ title: "Projeto" }} />
      <Stack.Screen name="finding/[id]" options={{ title: "Finding" }} />
    </Stack>
  );
}
