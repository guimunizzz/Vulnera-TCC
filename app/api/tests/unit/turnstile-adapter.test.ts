/**
 * Verifica a resposta Siteverify sem acoplar testes a rede ou banco de dados.
 * Reproduz o contrato das chaves dummy oficiais, inclusive action ausente.
 * Consumido pela suíte Jest da API.
 */

import { TurnstileCaptchaAdapter } from "../../src/adapters/turnstile-captcha.adapter";

describe("TurnstileCaptchaAdapter com resposta dummy oficial", () => {
  it("aceita resposta válida sem action quando não há expectativas de host/action", async () => {
    const now = Date.parse("2026-11-18T12:00:00.000Z");
    const fetcher = jest.fn<Promise<Response>, Parameters<typeof fetch>>().mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        success: true,
        challenge_ts: new Date(now).toISOString(),
        hostname: "example.com",
      }),
    } as Response);
    const adapter = new TurnstileCaptchaAdapter({
      secretKey: "test-secret",
      verifyUrl: "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      timeoutMs: 1_000,
    }, fetcher, () => now);

    await expect(adapter.verify({ token: "XXXX.DUMMY.TOKEN.XXXX" })).resolves.toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("rejeita hostname de teste quando uma expectativa real está configurada", async () => {
    const now = Date.parse("2026-11-18T12:00:00.000Z");
    const fetcher = jest.fn<Promise<Response>, Parameters<typeof fetch>>().mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        success: true,
        challenge_ts: new Date(now).toISOString(),
        hostname: "example.com",
      }),
    } as Response);
    const adapter = new TurnstileCaptchaAdapter({
      secretKey: "test-secret",
      verifyUrl: "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      expectedHostname: "localhost",
      expectedAction: "access-request",
      timeoutMs: 1_000,
    }, fetcher, () => now);

    await expect(adapter.verify({ token: "XXXX.DUMMY.TOKEN.XXXX" })).resolves.toBe(false);
  });
});
