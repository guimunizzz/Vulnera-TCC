/**
 * auth.store.ts
 *
 * Espelha app/web/src/store/auth.store.ts (Zustand + persist) — a única
 * troca é o storage: SecureStore no lugar de localStorage. SecureStore
 * criptografa em disco (Keychain no iOS, Keystore no Android); localStorage/
 * AsyncStorage não criptografam nada, por isso não servem pra token de sessão.
 */

import { create } from "zustand";
import { persist, createJSONStorage, type StateStorage } from "zustand/middleware";
import * as SecureStore from "expo-secure-store";
import type { AuthResponse, User } from "../types/auth.types";

const secureStorage: StateStorage = {
  getItem: async (name: string) => (await SecureStore.getItemAsync(name)) ?? null,
  setItem: async (name: string, value: string) => SecureStore.setItemAsync(name, value),
  removeItem: async (name: string) => SecureStore.deleteItemAsync(name),
};

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  /** true só depois que o SecureStore terminou de reidratar. Sem isso, o
   * boot piscaria a tela de login por uma fração de segundo mesmo com
   * sessão salva — ver app/index.tsx, que espera este flag antes de decidir
   * pra onde navegar. */
  hasHydrated: boolean;
  setAuth: (auth: AuthResponse) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  clearAuth: () => void;
  setHasHydrated: (value: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      hasHydrated: false,
      setAuth: (auth) =>
        set({ accessToken: auth.accessToken, refreshToken: auth.refreshToken, user: auth.user }),
      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
      clearAuth: () => set({ accessToken: null, refreshToken: null, user: null }),
      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: "vulnera-auth",
      storage: createJSONStorage(() => secureStorage),
      onRehydrateStorage: () => (state) => state?.setHasHydrated(true),
      // hasHydrated nunca precisa persistir — é recalculado a cada boot.
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
      }),
    },
  ),
);
