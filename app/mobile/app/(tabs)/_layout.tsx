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
 * Espera `hasHydrated` antes de decidir — igual a index.tsx. Sem isso, um
 * deep link/notificação que monta esse layout ANTES do SecureStore terminar
 * de reidratar leria accessToken como null (valor inicial) e deslogaria um
 * usuário com sessão válida.
 *
 * Também é onde o registro de push dispara (usePushRegistration) — roda uma
 * vez por sessão autenticada, independente de qual aba o usuário está vendo.
 */

import { Redirect, Tabs } from "expo-router";
import { useAuthStore } from "../../src/store/auth.store";
import { usePushRegistration } from "../../src/hooks/use-push-registration";
import { TabIcon } from "../../src/components/tab-icon";
import { haptics } from "../../src/lib/haptics";
import { LoadingState } from "../../src/components/states";
import { Screen } from "../../src/components/screen";
import { COLORS, FONT_FAMILY } from "../../src/theme/tokens";

export default function TabsLayout() {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
  usePushRegistration();

  if (!hasHydrated) {
    return (
      <Screen scroll={false}>
        <LoadingState label="Carregando sessão..." />
      </Screen>
    );
  }

  if (!accessToken) {
    return <Redirect href="/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.surface },
        headerTintColor: COLORS.textPrimary,
        headerTitleStyle: { fontFamily: FONT_FAMILY.semibold },
        headerShadowVisible: false,
        tabBarStyle: { backgroundColor: COLORS.surface, borderTopColor: COLORS.borderSubtle, height: 58, paddingBottom: 6, paddingTop: 6 },
        tabBarLabelStyle: { fontFamily: FONT_FAMILY.medium, fontSize: 11 },
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
            <TabIcon name={focused ? "folder" : "folder-outline"} color={color} size={size} focused={focused} />
          ),
        }}
        listeners={{ tabPress: () => haptics.tap() }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Configurações",
          tabBarIcon: ({ color, focused, size }) => (
            <TabIcon name={focused ? "settings" : "settings-outline"} color={color} size={size} focused={focused} />
          ),
        }}
        listeners={{ tabPress: () => haptics.tap() }}
      />
    </Tabs>
  );
}
