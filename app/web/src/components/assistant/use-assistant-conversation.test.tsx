/**
 * Valida prazos e retomada manual do chat sem depender do relógio das animações.
 * Protege cota, isolamento de sessão e ausência de reenvio; consumido pelo Vitest.
 */
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { assistantApi } from "../../lib/api/assistant.api";
import { useAuthStore } from "../../store/auth.store";
import { useAssistantConversation } from "./use-assistant-conversation";

vi.mock("../../lib/api/assistant.api", () => ({ assistantApi: { chat: vi.fn() } }));
const response = { source: "local" as const, message: "Sou a Vuvu.", actions: [] };

beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks();
  useAuthStore.getState().setAuth({ accessToken: "synthetic-access", refreshToken: "synthetic-refresh", user: {
    id: "qa-user", name: "Conta fictícia", email: "qa@example.invalid", role: "CLIENT", companyId: "qa-company", createdAt: "2026-11-16T00:00:00Z",
  } });
  vi.mocked(assistantApi.chat).mockResolvedValue(response);
});
afterEach(() => { cleanup(); useAuthStore.getState().clearAuth(); vi.useRealTimers(); });

describe("Espera manual do assistente", () => {
  it("libera após Retry-After e nunca envia por timer, inclusive depois de limpar a conversa", async () => {
    vi.mocked(assistantApi.chat).mockRejectedValueOnce({ isAxiosError: true, response: { status: 429, data: { retryAfterSeconds: 12 }, headers: {} } });
    const { result } = renderHook(() => useAssistantConversation("CLIENT"));
    await act(async () => { expect(await result.current.send("OQ E O VULNERA", "applications")).toBe(false); });
    expect(result.current.retryAfterSeconds).toBe(12);
    act(() => { result.current.clear(); vi.advanceTimersByTime(1_000); });
    expect(result.current.retryAfterSeconds).toBe(11);
    await act(async () => { expect(await result.current.send("OI", "applications")).toBe(false); });
    expect(assistantApi.chat).toHaveBeenCalledTimes(1);
    act(() => { vi.advanceTimersByTime(11_000); });
    expect(result.current.retryAfterSeconds).toBe(0); expect(result.current.error).toBeNull();
    expect(result.current.availability).toContain("já pode enviar"); expect(assistantApi.chat).toHaveBeenCalledTimes(1);
    await act(async () => { expect(await result.current.send("OI", "applications")).toBe(true); });
    expect(assistantApi.chat).toHaveBeenCalledTimes(2);
  });

  it("mantém prazo do provedor após ajuda básica e expira sem repetição automática", async () => {
    vi.mocked(assistantApi.chat).mockResolvedValueOnce({ ...response, providerRetryAfterSeconds: 60 });
    const { result } = renderHook(() => useAssistantConversation("CLIENT"));
    await act(async () => { await result.current.send("como faço uma analise", "applications"); });
    expect(result.current.providerRetryAfterSeconds).toBe(60); expect(result.current.retryAfterSeconds).toBe(0);
    await act(async () => { await result.current.send("quem e vc", "applications"); });
    expect(result.current.providerRetryAfterSeconds).toBe(60);
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(result.current.providerRetryAfterSeconds).toBe(0); expect(assistantApi.chat).toHaveBeenCalledTimes(2);
    expect(result.current.availability).toContain("enviar uma nova pergunta");
  });

  it("entende Retry-After em data HTTP e limpa timers ao sair da sessão", async () => {
    const date = new Date(Date.now() + 30_000).toUTCString();
    vi.mocked(assistantApi.chat).mockRejectedValueOnce({ isAxiosError: true, response: { status: 429, data: {}, headers: { "retry-after": date } } });
    const { result, unmount } = renderHook(() => useAssistantConversation("CLIENT"));
    await act(async () => { await result.current.send("OI", "applications"); });
    expect(result.current.retryAfterSeconds).toBeGreaterThanOrEqual(29);
    unmount(); expect(vi.getTimerCount()).toBe(0);
  });
});
