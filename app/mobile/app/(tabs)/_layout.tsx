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
 * Tab bar flutuante com glassmorphism: `tabBarStyle` posiciona o container
 * como um pill absoluto (não dockado — por isso as telas dentro das abas
 * reservam espaço extra no rodapé, ver TAB_BAR em theme/tokens.ts) e
 * `tabBarBackground` desenha o vidro fosco (BlurView + tint) atrás dos
 * ícones — é o mecanismo nativo do React Navigation pra isso, não uma tab
 * bar reimplementada do zero.
 */

import { StyleSheet, View } from "react-native";
import { Redirect, Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { useAuthStore } from "../../src/store/auth.store";
import { PushStatusContext, usePushRegistration } from "../../src/hooks/use-push-registration";
import { TabIcon } from "../../src/components/tab-icon";
import { haptics } from "../../src/lib/haptics";
import { LoadingState } from "../../src/components/states";
import { Screen } from "../../src/components/screen";
import { COLORS, FONT_FAMILY, SHADOW, TAB_BAR } from "../../src/theme/tokens";
import { WORKSPACE } from "../../src/theme/workspace";
import { useWorkspaceReducedMotion, WorkspaceMotionProvider } from "../../src/components/workspace-motion";
import { useActiveWorkspaceBlur, WorkspaceBlurProvider } from "../../src/components/workspace-blur";

export default function TabsLayout() {
  return <WorkspaceMotionProvider><WorkspaceBlurProvider><AuthenticatedTabs /></WorkspaceBlurProvider></WorkspaceMotionProvider>;
}

function AuthenticatedTabs() {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const insets = useSafeAreaInsets();
  const pushStatus = usePushRegistration();
  const reduced = useWorkspaceReducedMotion();
  const { target: blurTarget } = useActiveWorkspaceBlur();

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
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.surface },
        headerTintColor: COLORS.textPrimary,
        headerTitleStyle: { fontFamily: FONT_FAMILY.semibold },
        headerShadowVisible: false,
        headerShown: false,
        animation: reduced ? "none" : "fade",
        tabBarStyle: [
          styles.tabBar,
          {
            left: TAB_BAR.sideMargin,
            right: TAB_BAR.sideMargin,
            bottom: insets.bottom + TAB_BAR.bottomMargin,
            height: TAB_BAR.height,
          },
        ],
        // Sombra vai no container (transparente) pra não ser cortada pelo
        // overflow:hidden do vidro — ver nota no styles.backgroundWrap.
        tabBarBackground: () => (
          <View style={styles.backgroundWrap}>
            <BlurView intensity={45} tint="dark" blurTarget={blurTarget} blurMethod={blurTarget ? "dimezisBlurViewSdk31Plus" : "none"} style={StyleSheet.absoluteFill} />
            <View style={styles.tint} />
          </View>
        ),
        tabBarItemStyle: styles.tabBarItem,
        tabBarLabelStyle: { fontFamily: FONT_FAMILY.medium, fontSize: 12 },
        tabBarActiveTintColor: WORKSPACE.lavender,
        tabBarInactiveTintColor: WORKSPACE.muted,
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
          title: "Minha conta",
          tabBarIcon: ({ color, focused, size }) => (
            <TabIcon name={focused ? "settings" : "settings-outline"} color={color} size={size} focused={focused} />
          ),
        }}
        listeners={{ tabPress: () => haptics.tap() }}
      />
    </Tabs></PushStatusContext.Provider>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: "absolute",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(216,199,255,0.14)",
    backgroundColor: "transparent",
    ...SHADOW.raised,
  },
  // overflow:"hidden" fica aqui (não em `tabBar`) — é o que recorta o blur
  // nas pontas arredondadas do pill; se fosse no container de fora, também
  // cortaria a sombra no iOS.
  backgroundWrap: {
    ...StyleSheet.absoluteFill,
    borderRadius: 28,
    overflow: "hidden",
  },
  // Tint sólido semi-transparente por cima do blur — o vidro fosco puro
  // varia demais de legibilidade dependendo do que rola atrás; isso
  // garante contraste consistente do ícone/rótulo em qualquer conteúdo.
  tint: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#211b30",
    opacity: 0.70,
  },
  tabBarItem: {
    paddingTop: 8,
  },
});
