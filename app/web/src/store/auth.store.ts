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
  updateUser: (user: User, sessionUser: User) => boolean;
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
      updateUser: (user, sessionUser) => {
        // A referência identifica a sessão que iniciou a leitura: novo login
        // (até da mesma pessoa) invalida uma resposta antiga. Rotação de token
        // preserva a referência e os tokens atuais nunca são sobrescritos.
        if (get().user !== sessionUser || user.id !== sessionUser.id) return false;
        if (user.companyId !== sessionUser.companyId || user.companyRole !== sessionUser.companyRole || user.role !== sessionUser.role) {
          queryClient.clear();
        }
        set({ user });
        return true;
      },
      clearAuth: () => {
        queryClient.clear();
        set({ accessToken: null, refreshToken: null, user: null });
      },
    }),
    { name: "vulnera-auth" },
  ),
);
