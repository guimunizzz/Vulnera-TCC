/**
 * Confirma os limites de abuso e o tratamento neutro de corpos inválidos.
 * Garante buckets separados por operação, IP e token mesmo com o limite global desligado.
 * Consumido pelo Jest de integração da Etapa 5 da Issue #51.
 */
import request from "supertest";
import { createApp } from "../../src/app";
import { createRateLimitConfig } from "../../src/config/rate-limit.config";
import type { AccountActivationRateLimitConfig } from "../../src/config/account-activation-rate-limit.config";
import { makeRateLimitService } from "../../src/factories/rate-limit.factory";
import { AccountActivationRateLimitService } from "../../src/services/account-activation-rate-limit.service";
import { TokenBucketStore } from "../../src/utils/token-bucket.util";
import { generateAccessToken } from "../../src/utils/access-token.util";

const START_TIME = 1_000_000;

let nowMs: number;
let globalRateLimit: ReturnType<typeof makeRateLimitService>;
let limiter: AccountActivationRateLimitService;
let validate: jest.Mock<Promise<{ valid: boolean }>, [string]>;
let activate: jest.Mock<Promise<void>, [string, string]>;
let app: ReturnType<typeof createApp>;

function config(overrides: {
  validateIp?: number;
  validateToken?: number;
  activateIp?: number;
  activateToken?: number;
  maxKeys?: number;
} = {}): AccountActivationRateLimitConfig {
  const policy = (burst: number) => ({ burst, ratePerSecond: burst / 60 });
  return {
    storeTtlMs: 60_000,
    storeMaxKeys: overrides.maxKeys ?? 1_000,
    policies: {
      validateIp: policy(overrides.validateIp ?? 50),
      validateToken: policy(overrides.validateToken ?? 50),
      activateIp: policy(overrides.activateIp ?? 50),
      activateToken: policy(overrides.activateToken ?? 50),
    },
  };
}

function configure(overrides: Parameters<typeof config>[0] = {}): void {
  limiter?.dispose();
  globalRateLimit?.dispose();
  nowMs = START_TIME;
  globalRateLimit = makeRateLimitService(createRateLimitConfig({
    enabled: false,
    trustProxyHops: 1,
  }));
  limiter = new AccountActivationRateLimitService(
    config(overrides),
    new TokenBucketStore({
      ttlMs: 60_000,
      maxKeys: overrides.maxKeys ?? 1_000,
      nowMs: () => nowMs,
    }),
  );
  validate = jest.fn(async (_token: string) => ({ valid: true }));
  activate = jest.fn(async (_token: string, _password: string) => undefined);
  app = createApp({
    rateLimitService: globalRateLimit,
    accountActivationDependencies: { service: { validate, activate }, limiter },
  });
}

function fromIp<T extends { set(field: string, value: string): T }>(call: T, ip: string): T {
  return call.set("X-Forwarded-For", ip);
}

beforeEach(() => configure());

afterEach(() => {
  limiter?.dispose();
  globalRateLimit?.dispose();
});

describe("Proteções HTTP da ativação de conta", () => {
  it("mantém quatro buckets independentes por operação, IP e token com limiter global desligado", async () => {
    configure({ validateIp: 1, validateToken: 1, activateIp: 1, activateToken: 1 });
    const token = generateAccessToken().token;
    const otherToken = generateAccessToken().token;

    const validateAllowed = await fromIp(
      request(app).post("/api/account-activation/validate").send({ token }),
      "203.0.113.10",
    );
    expect(validateAllowed.status).toBe(200);

    const validateIpBlocked = await fromIp(
      request(app).post("/api/account-activation/validate").send({ token: otherToken }),
      "203.0.113.10",
    );
    expect(validateIpBlocked.status).toBe(429);
    expect(validateIpBlocked.body).toEqual({ error: "RATE_LIMITED" });
    expect(Number(validateIpBlocked.headers["retry-after"])).toBeGreaterThan(0);

    const validateTokenBlocked = await fromIp(
      request(app).post("/api/account-activation/validate").send({ token }),
      "203.0.113.11",
    );
    expect(validateTokenBlocked.status).toBe(429);
    expect(Number(validateTokenBlocked.headers["retry-after"])).toBeGreaterThan(0);

    const activateAllowed = await fromIp(
      request(app).post("/api/account-activation/activate").send({ token, password: "valid-password" }),
      "203.0.113.11",
    );
    expect(activateAllowed.status).toBe(204);

    const activateIpBlocked = await fromIp(
      request(app).post("/api/account-activation/activate").send({ token: otherToken, password: "valid-password" }),
      "203.0.113.11",
    );
    expect(activateIpBlocked.status).toBe(429);
    expect(Number(activateIpBlocked.headers["retry-after"])).toBeGreaterThan(0);

    const activateTokenBlocked = await fromIp(
      request(app).post("/api/account-activation/activate").send({ token, password: "valid-password" }),
      "203.0.113.12",
    );
    expect(activateTokenBlocked.status).toBe(429);
    expect(Number(activateTokenBlocked.headers["retry-after"])).toBeGreaterThan(0);
    expect(activateTokenBlocked.text).not.toContain(token);
    expect(validate).toHaveBeenCalledTimes(1);
    expect(activate).toHaveBeenCalledTimes(1);
  });

  it("limita o IP antes de parsear JSON malformado e não reflete o segredo", async () => {
    configure({ activateIp: 1 });
    const token = generateAccessToken().token;
    const malformed = await fromIp(
      request(app)
        .post("/api/account-activation/activate")
        .set("Content-Type", "application/json")
        .send(`{"token":"${token}","password":"private-value",`),
      "203.0.113.20",
    );

    expect(malformed.status).toBe(400);
    expect(malformed.body).toEqual({ error: "INVALID_BODY" });
    expect(malformed.text).not.toContain(token);
    expect(malformed.text).not.toContain("private-value");
    expect(activate).not.toHaveBeenCalled();

    const blockedRetry = await fromIp(
      request(app).post("/api/account-activation/activate").send({ token, password: "valid-password" }),
      "203.0.113.20",
    );
    expect(blockedRetry.status).toBe(429);
    expect(Number(blockedRetry.headers["retry-after"])).toBeGreaterThan(0);
    expect(activate).not.toHaveBeenCalled();
  });

  it("aplica limite de 8 KB também em caminho com caixa mista e não reflete corpo grande", async () => {
    configure({ activateIp: 1 });
    const token = generateAccessToken().token;
    const largePassword = "sensitive-large-password-".repeat(400);
    const oversized = await fromIp(
      request(app)
        .post("/API/ACCOUNT-ACTIVATION/activate")
        .set("Content-Type", "application/json")
        .send({ token, password: largePassword }),
      "203.0.113.21",
    );

    expect(oversized.status).toBe(413);
    expect(oversized.body).toEqual({ error: "PAYLOAD_TOO_LARGE" });
    expect(oversized.text).not.toContain(token);
    expect(oversized.text).not.toContain(largePassword);
    expect(activate).not.toHaveBeenCalled();

    const blockedRetry = await fromIp(
      request(app).post("/api/account-activation/activate").send({ token, password: "valid-password" }),
      "203.0.113.21",
    );
    expect(blockedRetry.status).toBe(429);
    expect(Number(blockedRetry.headers["retry-after"])).toBeGreaterThan(0);
  });

  it("sanitiza charset não suportado sem entregar HTML, stack ou conteúdo enviado", async () => {
    const token = generateAccessToken().token;
    const response = await fromIp(
      request(app)
        .post("/api/account-activation/activate")
        .set("Content-Type", "application/json; charset=unsupported-test")
        .send(`{"token":"${token}","password":"secret-body"}`),
      "203.0.113.22",
    );

    expect(response.status).toBe(415);
    expect(response.body).toEqual({ error: "UNSUPPORTED_BODY_ENCODING" });
    expect(response.text).not.toContain("<!DOCTYPE");
    expect(response.text).not.toContain("unsupported-test");
    expect(response.text).not.toContain(token);
    expect(response.text).not.toContain("secret-body");
  });

  it("falha fechado quando o store de buckets atinge sua capacidade", async () => {
    configure({ maxKeys: 1 });
    const response = await request(app)
      .post("/api/account-activation/validate")
      .send({ token: generateAccessToken().token });

    expect(response.status).toBe(429);
    expect(response.body).toEqual({ error: "RATE_LIMITED" });
    expect(Number(response.headers["retry-after"])).toBeGreaterThan(0);
    expect(validate).not.toHaveBeenCalled();
  });
});
