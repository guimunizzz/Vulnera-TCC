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
import { queryClient } from "../lib/query-client";

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
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      setAuth: (auth) => {
        // Leituras recentes pertencem à sessão: outro usuário precisa buscar
        // seu próprio escopo, mesmo que visite a mesma rota dentro de 30 s.
        if (get().user?.id !== auth.user.id) queryClient.clear();
        set({ accessToken: auth.accessToken, refreshToken: auth.refreshToken, user: auth.user });
      },
      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
      clearAuth: () => {
        queryClient.clear();
        set({ accessToken: null, refreshToken: null, user: null });
      },
    }),
    { name: "vulnera-auth" },
  ),
);
