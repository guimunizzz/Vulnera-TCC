/**
 * Exercita CAPTCHA, middleware e buckets públicos sem chamar os controllers reais.
 * Existe para validar Siteverify e os limites antes da integração HTTP da Issue #51;
 * usa um app Express mínimo e não limpa nem grava dados no banco.
 */

import express, { type Express } from "express";
import request from "supertest";
import { TurnstileCaptchaAdapter } from "../../src/adapters/turnstile-captcha.adapter";
import { AccessRequestRateLimitService } from "../../src/services/access-request-rate-limit.service";
import { makeAccessRequestProtectionMiddleware } from "../../src/middlewares/access-request-rate-limit.middleware";
import type { CaptchaVerifier } from "../../src/models/captcha.model";
import { TokenBucketStore } from "../../src/utils/token-bucket.util";
import { FakeCaptchaVerifier } from "../fixtures/fake-captcha-verifier";

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const HOSTNAME = "access.vulnera.example";
const ACTION = "access-request";

function turnstileConfig() {
  return {
    secretKey: "test-secret",
    verifyUrl: SITEVERIFY_URL,
    expectedHostname: HOSTNAME,
    expectedAction: ACTION,
    timeoutMs: 100,
  };
}

function validSiteverifyBody(nowMs: number) {
  return {
    success: true,
    challenge_ts: new Date(nowMs).toISOString(),
    hostname: HOSTNAME,
    action: ACTION,
  };
}

function rateLimitConfig(maxKeys = 100) {
  return {
    storeTtlMs: 60_000,
    storeMaxKeys: maxKeys,
    emailCooldownMs: 2_000,
    policies: {
      requestIp: { burst: 10, ratePerSecond: 1 },
      resendIp: { burst: 10, ratePerSecond: 1 },
      verifyIp: { burst: 10, ratePerSecond: 1 },
      email: { burst: 10, ratePerSecond: 1 },
    },
  };
}

function makeLimiter(nowMs: () => number, maxKeys = 100) {
  const config = rateLimitConfig(maxKeys);
  const store = new TokenBucketStore({
    ttlMs: config.storeTtlMs,
    maxKeys: config.storeMaxKeys,
    nowMs,
  });
  return { limiter: new AccessRequestRateLimitService(config, store), store };
}

function makeProtectionApp(
  limiter: Pick<AccessRequestRateLimitService, "consumeIp" | "consumeEmail">,
  captchaVerifier: CaptchaVerifier,
): Express {
  const app = express();
  app.use(express.json());
  app.post(
    "/request",
    makeAccessRequestProtectionMiddleware("request", { limiter, captchaVerifier }),
    (_req, res) => res.status(200).json({ accepted: true }),
  );
  app.post(
    "/resend",
    makeAccessRequestProtectionMiddleware("resend", { limiter, captchaVerifier }),
    (_req, res) => res.status(200).json({ accepted: true }),
  );
  app.post(
    "/verify",
    makeAccessRequestProtectionMiddleware("verify", { limiter, captchaVerifier }),
    (_req, res) => res.status(200).json({ accepted: true }),
  );
  return app;
}

describe("proteções públicas de AccessRequest", () => {
  it("envia segredo, token e IP ao Siteverify e aceita desafio coerente", async () => {
    const nowMs = Date.parse("2026-10-23T12:00:00.000Z");
    const fetchMock = jest.fn<Promise<Response>, [string, RequestInit?]>(async () => ({
      ok: true,
      headers: { get: () => "application/json; charset=utf-8" },
      json: async () => validSiteverifyBody(nowMs),
    }) as unknown as Response);
    const verifier = new TurnstileCaptchaAdapter(turnstileConfig(), fetchMock as unknown as typeof fetch, () => nowMs);

    await expect(verifier.verify({ token: "issued-token", remoteIp: "203.0.113.9" })).resolves.toBe(true);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(SITEVERIFY_URL);
    expect(init).toMatchObject({ method: "POST" });
    const form = new URLSearchParams(init?.body as string);
    expect(form.get("secret")).toBe("test-secret");
    expect(form.get("response")).toBe("issued-token");
    expect(form.get("remoteip")).toBe("203.0.113.9");
  });

  it("aceita resposta sem action quando nenhuma action é configurada", async () => {
    const nowMs = Date.parse("2026-10-23T12:00:00.000Z");
    const fetcher = jest.fn(async () => ({
      ok: true,
      headers: { get: () => "application/json" },
      json: async () => ({ success: true, challenge_ts: new Date(nowMs).toISOString(), hostname: HOSTNAME }),
    }) as unknown as Response);
    const verifier = new TurnstileCaptchaAdapter(
      { ...turnstileConfig(), expectedAction: undefined },
      fetcher as unknown as typeof fetch,
      () => nowMs,
    );

    await expect(verifier.verify({ token: "issued-token" })).resolves.toBe(true);
  });

  it("falha fechado para resposta inválida, desafio vencido e hostname/action divergentes", async () => {
    const nowMs = Date.parse("2026-10-23T12:00:00.000Z");
    const payloads: unknown[] = [
      { success: true, hostname: HOSTNAME, action: ACTION },
      { success: true, challenge_ts: "not-a-date", hostname: HOSTNAME, action: ACTION },
      { success: true, challenge_ts: new Date(nowMs - 301_000).toISOString(), hostname: HOSTNAME, action: ACTION },
      { success: true, challenge_ts: new Date(nowMs).toISOString(), hostname: "other.example", action: ACTION },
      { success: true, challenge_ts: new Date(nowMs).toISOString(), hostname: HOSTNAME, action: "other-action" },
      { success: false, "error-codes": ["invalid-input-response"] },
    ];

    for (const payload of payloads) {
      const fetcher = jest.fn(async () => ({
        ok: true,
        headers: { get: () => "application/json" },
        json: async () => payload,
      }) as unknown as Response);
      const verifier = new TurnstileCaptchaAdapter(turnstileConfig(), fetcher as unknown as typeof fetch, () => nowMs);
      await expect(verifier.verify({ token: "issued-token" })).resolves.toBe(false);
    }

    const nonJson = new TurnstileCaptchaAdapter(turnstileConfig(), jest.fn(async () => ({
      ok: true,
      headers: { get: () => "text/html" },
      json: async () => validSiteverifyBody(nowMs),
    }) as unknown as Response) as unknown as typeof fetch, () => nowMs);
    await expect(nonJson.verify({ token: "issued-token" })).resolves.toBe(false);

    const httpFailure = new TurnstileCaptchaAdapter(turnstileConfig(), jest.fn(async () => ({
      ok: false,
      headers: { get: () => "application/json" },
      json: async () => validSiteverifyBody(nowMs),
    }) as unknown as Response) as unknown as typeof fetch, () => nowMs);
    await expect(httpFailure.verify({ token: "issued-token" })).resolves.toBe(false);

    const invalidJson = new TurnstileCaptchaAdapter(turnstileConfig(), jest.fn(async () => ({
      ok: true,
      headers: { get: () => "application/json" },
      json: async () => { throw new Error("malformed JSON"); },
    }) as unknown as Response) as unknown as typeof fetch, () => nowMs);
    await expect(invalidJson.verify({ token: "issued-token" })).resolves.toBe(false);

    const networkFailure = new TurnstileCaptchaAdapter(turnstileConfig(), jest.fn(async () => {
      throw new Error("network unavailable");
    }) as unknown as typeof fetch, () => nowMs);
    await expect(networkFailure.verify({ token: "issued-token" })).resolves.toBe(false);

    const observedSignals: AbortSignal[] = [];
    const timeoutFetch = jest.fn((_url: unknown, init?: unknown) => new Promise<Response>((_resolve, reject) => {
      const signal = (init as RequestInit).signal;
      if (signal) {
        observedSignals.push(signal);
        signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
      }
    }));
    const timeoutVerifier = new TurnstileCaptchaAdapter(
      { ...turnstileConfig(), timeoutMs: 1 },
      timeoutFetch as unknown as typeof fetch,
      () => nowMs,
    );
    await expect(timeoutVerifier.verify({ token: "issued-token" })).resolves.toBe(false);
    expect(observedSignals[0]?.aborted).toBe(true);
  });

  it("fixture aceita apenas tokens emitidos, de uso único, e rejeita expirados ou falha simulada", async () => {
    let nowMs = 10_000;
    const verifier = new FakeCaptchaVerifier({ ttlMs: 1_000, nowMs: () => nowMs });
    const token = verifier.issueToken();

    await expect(verifier.verify({ token })).resolves.toBe(true);
    await expect(verifier.verify({ token })).resolves.toBe(false);

    const expiringToken = verifier.issueToken();
    nowMs += 1_000;
    await expect(verifier.verify({ token: expiringToken })).resolves.toBe(false);

    const unavailableToken = verifier.issueToken();
    verifier.setFailure(true);
    await expect(verifier.verify({ token: unavailableToken })).resolves.toBe(false);
  });

  it("usa e-mail normalizado em um bucket compartilhado e mantém o bloqueio até o refill completo", () => {
    let nowMs = 0;
    const { limiter, store } = makeLimiter(() => nowMs);
    try {
      expect(limiter.consumeEmail("  Security@Example.com ").allowed).toBe(true);
      const blocked = limiter.consumeEmail("security@example.com");
      expect(blocked.allowed).toBe(false);
      expect(blocked.retryAfterSeconds).toBe(2);

      nowMs = 1_999;
      expect(limiter.consumeEmail("security@example.com").allowed).toBe(false);
      nowMs = 2_000;
      expect(limiter.consumeEmail("security@example.com").allowed).toBe(true);
    } finally {
      store.dispose();
    }
  });

  it("falha fechado quando o store dedicado chega ao limite de chaves", () => {
    const { limiter, store } = makeLimiter(() => 0, 1);
    try {
      expect(limiter.consumeIp("request", "203.0.113.1").allowed).toBe(true);
      const secondAddress = limiter.consumeIp("request", "203.0.113.2");
      expect(secondAddress.allowed).toBe(false);
      expect(store.size()).toBe(1);
    } finally {
      store.dispose();
    }
  });

  it("limita o IP antes do CAPTCHA, compartilha cooldown entre request/resend e não exige CAPTCHA para verify", async () => {
    let nowMs = 50_000;
    const config = rateLimitConfig();
    config.policies.requestIp = { burst: 1, ratePerSecond: 1 };
    const store = new TokenBucketStore({ ttlMs: config.storeTtlMs, maxKeys: config.storeMaxKeys, nowMs: () => nowMs });
    const limiter = new AccessRequestRateLimitService(config, store);
    const captchaVerifier = new FakeCaptchaVerifier({ ttlMs: 60_000, nowMs: () => nowMs });
    const verifySpy = jest.spyOn(captchaVerifier, "verify");
    const app = makeProtectionApp(limiter, captchaVerifier);

    try {
      await request(app)
        .post("/request")
        .send({ email: "Owner@example.com", captchaToken: captchaVerifier.issueToken() })
        .expect(200);
      expect(verifySpy).toHaveBeenCalledTimes(1);

      // IP esgota antes da verificação, então a ausência de CAPTCHA não alcança o provedor.
      const limitedByIp = await request(app).post("/request").send({ email: "other@example.com" }).expect(429);
      expect(limitedByIp.headers["retry-after"]).toBe("1");
      expect(limitedByIp.body.code).toBe("RATE_LIMITED");
      expect(verifySpy).toHaveBeenCalledTimes(1);

      nowMs += 1_000;
      await request(app)
        .post("/resend")
        .send({ email: "owner@EXAMPLE.com", captchaToken: captchaVerifier.issueToken() })
        .expect(429);

      // O endpoint de confirmação usa somente IP: não pede captchaToken.
      await request(app).post("/verify").send({ token: "verification-token" }).expect(200);
    } finally {
      limiter.dispose();
    }
  });

  it("não deixa CAPTCHA inválido consumir o cooldown de e-mail", async () => {
    const nowMs = 90_000;
    const { limiter, store } = makeLimiter(() => nowMs);
    const captchaVerifier = new FakeCaptchaVerifier({ nowMs: () => nowMs });
    const app = makeProtectionApp(limiter, captchaVerifier);

    try {
      await request(app)
        .post("/request")
        .send({ email: "owner@example.com", captchaToken: "not-issued" })
        .expect(400);

      await request(app)
        .post("/request")
        .send({ email: "OWNER@example.com", captchaToken: captchaVerifier.issueToken() })
        .expect(200);
    } finally {
      store.dispose();
    }
  });
});
