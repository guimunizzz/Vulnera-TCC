/**
 * store/theme.store.ts
 *
 * Gerencia a preferência entre Roxo escuro e Roxo profundo,
 * persistida no SecureStore em Android/iOS e em memória no preview web.
 * Existe para permitir alternância imediata em Minha conta refletida em todas
 * as telas autenticadas, barra inferior, StatusBar e tela de login.
 * Consumidores: useAppTheme() e seção Aparência em app/(tabs)/settings.tsx.
 */

import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

export type ThemeMode = "dark" | "deep";

const webThemeMemory = new Map<string, string>();
const themeStorage: StateStorage =
  Platform.OS === "web"
    ? {
        getItem: async (name) => webThemeMemory.get(name) ?? null,
        setItem: async (name, value) => {
          webThemeMemory.set(name, value);
        },
        removeItem: async (name) => {
          webThemeMemory.delete(name);
        },
      }
    : {
        getItem: async (name: string) => (await SecureStore.getItemAsync(name)) ?? null,
        setItem: async (name: string, value: string) => SecureStore.setItemAsync(name, value),
        removeItem: async (name: string) => SecureStore.deleteItemAsync(name),
      };

interface ThemeState {
  mode: ThemeMode;
  hasHydrated: boolean;
  setMode: (mode: ThemeMode) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: "dark",
      hasHydrated: false,
      setMode: (mode) => set({ mode }),
    }),
    {
      name: "vulnera-theme",
      version: 1,
      storage: createJSONStorage(() => themeStorage),
      partialize: (state) => ({ mode: state.mode }),
      migrate: (stored) => {
        const savedMode = (stored as { mode?: unknown } | null)?.mode;
        return { mode: savedMode === "light" || savedMode === "deep" ? "deep" : "dark" };
      },
      // Aguarda a preferência antes de liberar a interface, inclusive se a
      // leitura segura falhar, evitando troca tardia sobre a escolha do usuário.
      onRehydrateStorage: () => () => useThemeStore.setState({ hasHydrated: true }),
    },
  ),
);
