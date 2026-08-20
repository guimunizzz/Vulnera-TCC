/**
 * auth.store.ts
 *
 * Estado global de autenticação (Zustand + persist em localStorage).
 * Exportado como store "puro" (getState/setState) porque o client Axios
 * precisa ler/escrever tokens fora de componentes React (no interceptor).
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AuthResponse, User } from "../types/auth.types";

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  setAuth: (auth: AuthResponse) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      setAuth: (auth) =>
        set({ accessToken: auth.accessToken, refreshToken: auth.refreshToken, user: auth.user }),
      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
      clearAuth: () => set({ accessToken: null, refreshToken: null, user: null }),
    }),
    { name: "vulnera-auth" },
  ),
);
