/**
 * auth.store.test.ts
 *
 * Verifica que o cache recente pertença à sessão autenticada.
 * Evita reaproveitar dados de outro usuário ao trocar de conta; consumido
 * pela suíte Vitest do frontend, sem API nem credenciais reais.
 */

import { afterEach, describe, expect, it } from "vitest";
import { queryClient } from "../lib/query-client";
import { useAuthStore } from "./auth.store";
import type { AuthResponse } from "../types/auth.types";

function session(id: string): AuthResponse {
  return {
    accessToken: `access-${id}`, refreshToken: `refresh-${id}`,
    user: { id, name: id, email: `${id}@test.local`, role: "CLIENT", companyId: id, createdAt: "2026-10-01T00:00:00Z" },
  };
}

afterEach(() => useAuthStore.getState().clearAuth());

describe("Cache de leitura por sessão", () => {
  it("limpa os dados recentes ao autenticar outro usuário", () => {
    useAuthStore.getState().setAuth(session("company-a"));
    queryClient.setQueryData(["projects"], ["Projeto da empresa A"]);
    useAuthStore.getState().setAuth(session("company-b"));
    expect(queryClient.getQueryData(["projects"])).toBeUndefined();
    expect(useAuthStore.getState().user?.id).toBe("company-b");
  });

  it("limpa o cache ao sair", () => {
    queryClient.setQueryData(["projects"], ["Projeto privado"]);
    useAuthStore.getState().clearAuth();
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });

  it("preserva leituras da mesma sessão durante a rotação dos tokens", () => {
    useAuthStore.getState().setAuth(session("company-a"));
    queryClient.setQueryData(["projects"], ["Projeto da empresa A"]);
    useAuthStore.getState().setTokens("rotated-access", "rotated-refresh");
    expect(queryClient.getQueryData(["projects"])).toEqual(["Projeto da empresa A"]);
  });
});
