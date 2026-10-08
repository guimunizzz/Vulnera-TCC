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
 *
 * Modelo 7: luz roxa atravessa o vidro com pulsação e fade de 400 ms.
 * O React Navigation mantém rotas/eventos; a cápsula respeita área segura
 * e o respiro compartilhado em TAB_BAR, sem mudar as telas ou consultas.
 */

import { Easing } from "react-native";
import { Redirect, Tabs } from "expo-router";
import { useAuthStore } from "../../src/store/auth.store";
import { PushStatusContext, usePushRegistration } from "../../src/hooks/use-push-registration";
import { IconGlassTabBar, TAB_TRANSITION_DURATION } from "../../src/components/icon-glass-tab-bar";
import { haptics } from "../../src/lib/haptics";
import { LoadingState } from "../../src/components/states";
import { Screen } from "../../src/components/screen";
import { COLORS, FONT_FAMILY } from "../../src/theme/tokens";
import { useWorkspaceReducedMotion, WorkspaceMotionProvider } from "../../src/components/workspace-motion";
import { WorkspaceBlurProvider } from "../../src/components/workspace-blur";

export default function TabsLayout() {
  return <WorkspaceMotionProvider><WorkspaceBlurProvider><AuthenticatedTabs /></WorkspaceBlurProvider></WorkspaceMotionProvider>;
}

function AuthenticatedTabs() {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const pushStatus = usePushRegistration();
  const reduced = useWorkspaceReducedMotion();

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
    <PushStatusContext.Provider value={pushStatus}><Tabs
      tabBar={(props) => <IconGlassTabBar {...props} />}
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.surface },
        headerTintColor: COLORS.textPrimary,
        headerTitleStyle: { fontFamily: FONT_FAMILY.semibold },
        headerShadowVisible: false,
        headerShown: false,
        animation: reduced ? "none" : "fade",
        transitionSpec: { animation: "timing", config: { duration: reduced ? 0 : TAB_TRANSITION_DURATION, easing: Easing.bezier(0.22, 1, 0.36, 1) } },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          headerShown: false,
          title: "Projetos",
        }}
        listeners={{ tabPress: () => haptics.tap() }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Minha conta",
        }}
        listeners={{ tabPress: () => haptics.tap() }}
      />
    </Tabs></PushStatusContext.Provider>
  );
}
