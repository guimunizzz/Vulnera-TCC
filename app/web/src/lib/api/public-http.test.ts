/**
 * Verifica o transporte anônimo sem sessão, armazenamento ou refresh automático.
 * Protege os contratos de erro e de Retry-After usados pelas páginas públicas.
 * Consumido pelo Vitest focal do cliente HTTP público.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PublicApiError, publicPost } from "./public-http";

const API = "http://localhost:3001/api";

beforeEach(() => {
  vi.stubEnv("VITE_API_URL", API);
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("publicPost", () => {
  it("envia JSON sem credenciais nem header de autorização", async () => {
    const localGet = vi.spyOn(localStorage, "getItem");
    const sessionGet = vi.spyOn(sessionStorage, "getItem");
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ message: "ok" }), { status: 202 }));

    await expect(publicPost("/access-requests", { name: "Pessoa", captchaToken: "captcha" }))
      .resolves.toEqual({ message: "ok" });

    expect(fetch).toHaveBeenCalledWith(`${API}/access-requests`, expect.objectContaining({
      method: "POST",
      credentials: "omit",
      cache: "no-store",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ name: "Pessoa", captchaToken: "captcha" }),
    }));
    const [, request] = vi.mocked(fetch).mock.calls[0];
    expect(request?.headers).not.toHaveProperty("Authorization");
    expect(request?.credentials).toBe("omit");
    expect(localGet).not.toHaveBeenCalled();
    expect(sessionGet).not.toHaveBeenCalled();
  });

  it("converte 204 para undefined", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(publicPost<void>("/access-requests/activate", {})).resolves.toBeUndefined();
  });

  it.each([
    [{ error: "INVALID_VERIFICATION_TOKEN" }, "INVALID_VERIFICATION_TOKEN"],
    [{ code: "INVALID_VERIFICATION_TOKEN" }, "INVALID_VERIFICATION_TOKEN"],
  ])("aceita o código de erro em ambos os formatos de resposta", async (payload, code) => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(payload), { status: 400 }));
    await expect(publicPost("/access-requests/verify-email", { token: "secret" }))
      .rejects.toMatchObject({ name: "PublicApiError", status: 400, code });
  });

  it("preserva Retry-After e retryAfterSeconds em respostas 429", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ error: "RATE_LIMITED" }), {
      status: 429,
      headers: { "Retry-After": "7" },
    }));
    await expect(publicPost("/access-requests", {})).rejects.toMatchObject({
      name: "PublicApiError",
      status: 429,
      code: "RATE_LIMITED",
      retryAfterSeconds: 7,
    });

    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ code: "RATE_LIMITED", retryAfterSeconds: 11 }), { status: 429 }));
    await expect(publicPost("/access-requests", {})).rejects.toMatchObject({ retryAfterSeconds: 11 });
  });

  it("substitui detalhes de rede por erro genérico sem incluir a URL ou PII", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("rafael@example.test http://private/path"));
    try {
      await publicPost("/access-requests", { email: "rafael@example.test" });
      throw new Error("era esperado rejeitar");
    } catch (error) {
      expect(error).toBeInstanceOf(PublicApiError);
      expect(error).toMatchObject({ status: 0, code: "NETWORK_ERROR" });
      expect((error as Error).message).not.toContain("rafael@example.test");
      expect((error as Error).message).not.toContain("private/path");
    }
  });
});
