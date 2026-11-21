/**
 * app/_layout.tsx — layout raiz do Expo Router
 *
 * Monta os providers que o app inteiro precisa (TanStack Query, área segura)
 * e declara as rotas de nível mais alto: `index` (splash/redirect por
 * estado de auth), `login` (pública) e `(tabs)` (protegida — ver
 * app/(tabs)/_layout.tsx, que checa a sessão de novo antes de renderizar).
 *
 * Também segura a splash nativa até a Archivo/JetBrains Mono carregarem
 * (useFonts) — sem isso, a primeira tela pisca com a fonte do sistema antes
 * de trocar pra Archivo, o que é mais chamativo que só esperar os ~200-400ms.
 */

import { useEffect } from "react";
import { Appearance, AppState, Platform } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { focusManager, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import {
  useFonts,
  Archivo_400Regular,
  Archivo_500Medium,
  Archivo_600SemiBold,
  Archivo_700Bold,
} from "@expo-google-fonts/archivo";
import { JetBrainsMono_400Regular, JetBrainsMono_700Bold } from "@expo-google-fonts/jetbrains-mono";
import { queryClient } from "../src/lib/query-client";
import { FONT_FAMILY } from "../src/theme/tokens";
import { useAppTheme } from "../src/theme/use-app-theme";
import { useThemeStore } from "../src/store/theme.store";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { colors, workspace } = useAppTheme();
  const scheme = workspace.blurTint;
  const themeHydrated = useThemeStore((state) => state.hasHydrated);
  useEffect(() => {
    if (Platform.OS !== "web" && themeHydrated) Appearance.setColorScheme(scheme);
  }, [scheme, themeHydrated]);
  useEffect(() => {
    if (Platform.OS === "web") return;
    const listener = AppState.addEventListener("change", (state) => focusManager.setFocused(state === "active"));
    return () => listener.remove();
  }, []);
  const [fontsLoaded, fontError] = useFonts({
    Archivo_400Regular,
    Archivo_500Medium,
    Archivo_600SemiBold,
    Archivo_700Bold,
    JetBrainsMono_400Regular,
    JetBrainsMono_700Bold,
  });

  useEffect(() => {
    // fontError também libera a splash — se a fonte falhar em carregar, o RN
    // cai pra fonte do sistema sozinho (nome de família não registrado não
    // trava nada); o que NÃO pode acontecer é a tela ficar presa em `null`
    // pra sempre esperando um `fontsLoaded` que nunca vira true.
    if ((fontsLoaded || fontError) && themeHydrated) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError, themeHydrated]);

  if ((!fontsLoaded && !fontError) || !themeHydrated) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style={workspace.statusBarStyle} />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.surface },
            headerTintColor: colors.textPrimary,
            headerTitleStyle: { fontFamily: FONT_FAMILY.semibold },
            headerShadowVisible: false,
            contentStyle: { backgroundColor: colors.canvas },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
