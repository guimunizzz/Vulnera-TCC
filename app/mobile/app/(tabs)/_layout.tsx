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
 * Modelo 7: indicador roxo deslizante e ícone com escala leve em 320 ms.
 * O conteúdo acompanha com fade e deslocamento lateral de 28 px: Configurações
 * entra pela direita e Home pela esquerda, seguindo a ordem real das abas.
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
import { FONT_FAMILY } from "../../src/theme/tokens";
import { useAppTheme } from "../../src/theme/use-app-theme";
import { useWorkspaceReducedMotion, WorkspaceMotionProvider } from "../../src/components/workspace-motion";
import { WorkspaceBlurProvider } from "../../src/components/workspace-blur";
import { AssistantSession } from "../../src/components/assistant";

export default function TabsLayout() {
  return <WorkspaceMotionProvider><WorkspaceBlurProvider><AuthenticatedTabs /></WorkspaceBlurProvider></WorkspaceMotionProvider>;
}

function AuthenticatedTabs() {
  const { colors, workspace } = useAppTheme();
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const userId = useAuthStore((s) => s.user?.id);
  const sessionVersion = useAuthStore((s) => s.sessionVersion);
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
    <PushStatusContext.Provider value={pushStatus}><AssistantSession key={`${sessionVersion}:${userId ?? "none"}`}><Tabs
      detachInactiveScreens={false}
      tabBar={(props) => <IconGlassTabBar {...props} />}
      screenOptions={{
        lazy: false,
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.textPrimary,
        headerTitleStyle: { fontFamily: FONT_FAMILY.semibold },
        headerShadowVisible: false,
        headerShown: false,
        sceneStyle: { backgroundColor: workspace.background },
        animation: reduced ? "none" : "fade",
        transitionSpec: { animation: "timing", config: { duration: reduced ? 0 : TAB_TRANSITION_DURATION, easing: Easing.out(Easing.cubic) } },
      }}
    >
      <Tabs.Screen name="dashboard" options={{ title: "Painel" }} listeners={{ tabPress: () => haptics.tap() }} />
      <Tabs.Screen
        name="home"
        options={{
          headerShown: false,
          title: "Projetos",
        }}
        listeners={{ tabPress: () => haptics.tap() }}
      />
      <Tabs.Screen name="security" options={{ title: "Segurança" }} listeners={{ tabPress: () => haptics.tap() }} />
      <Tabs.Screen name="reports" options={{ title: "Relatórios" }} listeners={{ tabPress: () => haptics.tap() }} />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Minha conta",
        }}
        listeners={{ tabPress: () => haptics.tap() }}
      />
    </Tabs></AssistantSession></PushStatusContext.Provider>
  );
}
