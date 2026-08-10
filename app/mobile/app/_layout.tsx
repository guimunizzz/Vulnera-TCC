/**
 * app/_layout.tsx — layout raiz do Expo Router
 *
 * Monta os providers que o app inteiro precisa (TanStack Query, área segura)
 * e declara as rotas de nível mais alto: `index` (splash/redirect por
 * estado de auth), `login` (pública) e `(tabs)` (protegida — ver
 * app/(tabs)/_layout.tsx, que checa a sessão de novo antes de renderizar).
 */

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { queryClient } from "../src/lib/query-client";
import { COLORS } from "../src/theme/tokens";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: COLORS.surface },
            headerTintColor: COLORS.textPrimary,
            headerShadowVisible: false,
            contentStyle: { backgroundColor: COLORS.canvas },
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
