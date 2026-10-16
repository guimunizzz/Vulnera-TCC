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

  it("atualiza o perfil e descarta cache de outro escopo sem sobrescrever tokens rotacionados", () => {
    const auth = session("owner");
    auth.user.companyId = null;
    useAuthStore.getState().setAuth(auth);
    queryClient.setQueryData(["projects"], ["Leitura antes do cadastro"]);
    useAuthStore.getState().setTokens("rotated-access", "rotated-refresh");
    const owner = { ...auth.user, companyId: "new-company", companyRole: "OWNER" };
    expect(useAuthStore.getState().updateUser(owner, auth.user)).toBe(true);
    expect(queryClient.getQueryData(["projects"])).toBeUndefined();
    expect(useAuthStore.getState()).toMatchObject({ user: owner, accessToken: "rotated-access", refreshToken: "rotated-refresh" });
  });

  it("preserva o cache ao atualizar perfil sem mudar o escopo", () => {
    const auth = session("owner");
    useAuthStore.getState().setAuth(auth);
    queryClient.setQueryData(["projects"], ["Projeto da mesma empresa"]);
    expect(useAuthStore.getState().updateUser({ ...auth.user, name: "Nome atualizado" }, auth.user)).toBe(true);
    expect(queryClient.getQueryData(["projects"])).toEqual(["Projeto da mesma empresa"]);
  });

  it("recusa resposta de perfil de outra sessão, inclusive novo login da mesma pessoa", () => {
    const previous = session("owner");
    useAuthStore.getState().setAuth(previous);
    const current = session("owner");
    useAuthStore.getState().setAuth(current);
    queryClient.setQueryData(["projects"], ["Cache da nova sessão"]);
    expect(useAuthStore.getState().updateUser({ ...previous.user, companyRole: "OWNER" }, previous.user)).toBe(false);
    expect(useAuthStore.getState().user).toBe(current.user);
    expect(queryClient.getQueryData(["projects"])).toEqual(["Cache da nova sessão"]);
  });

  it("recusa perfil de outro usuário e resposta após logout", () => {
    const auth = session("owner");
    useAuthStore.getState().setAuth(auth);
    expect(useAuthStore.getState().updateUser(session("other").user, auth.user)).toBe(false);
    useAuthStore.getState().clearAuth();
    expect(useAuthStore.getState().updateUser(auth.user, auth.user)).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
  });
});
