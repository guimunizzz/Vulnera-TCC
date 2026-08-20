/**
 * app/(tabs)/_layout.tsx
 *
 * Barra de abas inferior — padrão mais reconhecível de navegação mobile do
 * que um menu escondido atrás de um ícone, e é só isso que o escopo enxuto
 * do CLIENT precisa: "meus projetos" e "configurações". Redireciona pro
 * login se a sessão não existir (segunda linha de defesa — index.tsx já
 * faz essa checagem antes de chegar aqui, mas um deep link direto pra
 * /(tabs)/home pularia aquela checagem).
 *
 * Também é onde o registro de push dispara (usePushRegistration) — roda uma
 * vez por sessão autenticada, independente de qual aba o usuário está vendo.
 */

import { Redirect, Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../../src/store/auth.store";
import { usePushRegistration } from "../../src/hooks/use-push-registration";
import { COLORS } from "../../src/theme/tokens";

export default function TabsLayout() {
  const accessToken = useAuthStore((s) => s.accessToken);
  usePushRegistration();

  if (!accessToken) {
    return <Redirect href="/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.surface },
        headerTintColor: COLORS.textPrimary,
        headerShadowVisible: false,
        tabBarStyle: { backgroundColor: COLORS.surface, borderTopColor: COLORS.borderSubtle },
        tabBarActiveTintColor: COLORS.accentInk,
        tabBarInactiveTintColor: COLORS.textMuted,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          headerShown: false,
          title: "Projetos",
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons name={focused ? "folder" : "folder-outline"} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Configurações",
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons name={focused ? "settings" : "settings-outline"} color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
