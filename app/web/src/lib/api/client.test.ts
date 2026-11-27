/**
 * Verifica o isolamento de requisições e de refresh entre sessões.
 * Consumido pelo Vitest com transporte Axios simulado, sem API externa.
 */
import axios, { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "../../store/auth.store";
import { apiClient } from "./client";

function login(id: string) {
  useAuthStore.getState().setAuth({
    accessToken: `access-${id}`, refreshToken: `refresh-${id}`,
    user: { id, name: id, email: `${id}@example.test`, role: "CLIENT", companyId: id, createdAt: "" },
  });
}

function response(config: InternalAxiosRequestConfig, status: number, data: unknown = null): AxiosResponse {
  return { status, config, data, statusText: "", headers: {} };
}

function delayed<T>() {
  let complete!: (value: T) => void;
  const result = new Promise<T>((resolve) => { complete = resolve; });
  return { result, complete };
}

function rejectStatus(config: InternalAxiosRequestConfig, status: number): never {
  throw new AxiosError("Falha HTTP", undefined, config, undefined, response(config, status));
}

afterEach(() => {
  vi.restoreAllMocks();
  useAuthStore.getState().clearAuth();
});

describe("Cliente HTTP por sessão", () => {
  it.each([403, 404])("propaga %s sem renovar a sessão", async (status) => {
    login("a");
    const refresh = vi.spyOn(axios, "post");
    await expect(apiClient.get("/resource", {
      adapter: async (config) => rejectStatus(config, status),
    })).rejects.toMatchObject({ response: { status } });
    expect(refresh).not.toHaveBeenCalled();
  });

  it("compartilha um refresh entre leituras da mesma sessão e usa o token rotacionado", async () => {
    login("a");
    const pending = delayed<{ data: { accessToken: string; refreshToken: string } }>();
    const refresh = vi.spyOn(axios, "post").mockReturnValue(pending.result);
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
      if (config.headers.Authorization !== "Bearer new-a") rejectStatus(config, 401);
      return response(config, 200, "ok");
    });
    const reads = Promise.all([apiClient.get("/one", { adapter }), apiClient.get("/two", { adapter })]);
    await vi.waitFor(() => expect(adapter).toHaveBeenCalledTimes(2));
    expect(refresh).toHaveBeenCalledTimes(1);
    pending.complete({ data: { accessToken: "new-a", refreshToken: "next-a" } });
    expect((await reads).map((read) => read.data)).toEqual(["ok", "ok"]);
    expect(adapter).toHaveBeenCalledTimes(4);
  });

  it("descarta um refresh antigo após troca de usuário e não reenvia a leitura", async () => {
    login("a");
    const pending = delayed<{ data: { accessToken: string; refreshToken: string } }>();
    const refresh = vi.spyOn(axios, "post").mockReturnValue(pending.result);
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => rejectStatus(config, 401));
    const rejected = expect(apiClient.get("/resource", { adapter })).rejects.toMatchObject({ code: "ERR_CANCELED" });
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    login("b");
    pending.complete({ data: { accessToken: "new-a", refreshToken: "next-a" } });
    await rejected;
    expect(adapter).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState()).toMatchObject({ accessToken: "access-b", refreshToken: "refresh-b" });
  });

  it("descarta uma resposta de sucesso recebida após logout", async () => {
    login("a");
    const pending = delayed<string>();
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => response(config, 200, await pending.result));
    const rejected = expect(apiClient.get("/resource", { adapter })).rejects.toMatchObject({ code: "ERR_CANCELED" });
    await vi.waitFor(() => expect(adapter).toHaveBeenCalledTimes(1));
    useAuthStore.getState().clearAuth();
    pending.complete("dados da sessão anterior");
    await rejected;
  });
});
