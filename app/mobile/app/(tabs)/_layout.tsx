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
import { usePushRegistration } from "../../src/hooks/use-push-registration";
import { TabIcon } from "../../src/components/tab-icon";
import { haptics } from "../../src/lib/haptics";
import { LoadingState } from "../../src/components/states";
import { Screen } from "../../src/components/screen";
import { COLORS, FONT_FAMILY, RADIUS, SHADOW, TAB_BAR } from "../../src/theme/tokens";

export default function TabsLayout() {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const insets = useSafeAreaInsets();
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
            <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={styles.tint} />
          </View>
        ),
        tabBarItemStyle: styles.tabBarItem,
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

const styles = StyleSheet.create({
  tabBar: {
    position: "absolute",
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "transparent",
    ...SHADOW.raised,
  },
  // overflow:"hidden" fica aqui (não em `tabBar`) — é o que recorta o blur
  // nas pontas arredondadas do pill; se fosse no container de fora, também
  // cortaria a sombra no iOS.
  backgroundWrap: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: RADIUS.full,
    overflow: "hidden",
  },
  // Tint sólido semi-transparente por cima do blur — o vidro fosco puro
  // varia demais de legibilidade dependendo do que rola atrás; isso
  // garante contraste consistente do ícone/rótulo em qualquer conteúdo.
  tint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.surface,
    opacity: 0.55,
  },
  tabBarItem: {
    paddingTop: 8,
  },
});
