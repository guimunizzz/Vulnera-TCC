/**
 * rate-limit.config.ts
 *
 * Centraliza a configuração de rate limiting da API. Existe para que limites
 * possam mudar por ambiente sem espalhar números por controllers ou rotas.
 * Consumido pela factory e pelos testes determinísticos do limiter.
 */

import { EnvVar } from "./EnvVar";
import { EnvKeys } from "./enum/EnvKeys";

export type RateLimitScope =
  | "global"
  | "tenant"
  | "user"
  | "write"
  | "expensive"
  | "report"
  | "dast"
  | "auth-login-ip"
  | "auth-login-account"
  | "auth-register-ip"
  | "auth-refresh";

export interface TokenBucketPolicy {
  ratePerSecond: number;
  burst: number;
}

export interface RateLimitConfig {
  enabled: boolean;
  trustProxyHops: number;
  storeTtlMs: number;
  storeMaxKeys: number;
  tenantCacheTtlMs: number;
  tenantCacheMaxKeys: number;
  policies: Record<RateLimitScope, TokenBucketPolicy>;
}

type RateLimitConfigOverrides = Partial<Omit<RateLimitConfig, "policies">> & {
  policies?: Partial<Record<RateLimitScope, TokenBucketPolicy>>;
};

function optionalNumber(key: EnvKeys, fallback: number, minimum = 0): number {
  const raw = EnvVar.getOptional(key, String(fallback));
  const value = Number(raw);
  if (!Number.isFinite(value) || value < minimum) return fallback;
  return value;
}

function optionalBoolean(key: EnvKeys, fallback: boolean): boolean {
  const raw = EnvVar.getOptional(key, String(fallback)).trim().toLowerCase();
  if (["true", "1"].includes(raw)) return true;
  if (["false", "0"].includes(raw)) return false;
  return fallback;
}

function perMinute(value: number, burst: number): TokenBucketPolicy {
  return { ratePerSecond: value / 60, burst };
}

/**
 * Lê defaults seguros para produção. Testes usam `createRateLimitConfig()`
 * com overrides e a API padrão desliga o limiter quando NODE_ENV=test, para
 * que a suíte inteira não fique dependente da ordem das requisições.
 */
export function loadRateLimitConfig(): RateLimitConfig {
  const globalRps = optionalNumber(EnvKeys.RATE_LIMIT_GLOBAL_RPS, 5, 0.001);
  const tenantRps = optionalNumber(EnvKeys.RATE_LIMIT_TENANT_RPS, 2, 0.001);
  const userRps = optionalNumber(EnvKeys.RATE_LIMIT_USER_RPS, 1, 0.001);
  const authWindowMs = optionalNumber(EnvKeys.RATE_LIMIT_AUTH_WINDOW_MS, 5 * 60_000, 1_000);
  const authWindowSeconds = authWindowMs / 1_000;
  const testDefault = EnvVar.getOptional(EnvKeys.NODE_ENV, "development") !== "test";

  return createRateLimitConfig({
    enabled: optionalBoolean(EnvKeys.RATE_LIMIT_ENABLED, testDefault),
    trustProxyHops: Math.floor(optionalNumber(EnvKeys.TRUST_PROXY_HOPS, 0, 0)),
    storeTtlMs: Math.floor(optionalNumber(EnvKeys.RATE_LIMIT_STORE_TTL_MS, 10 * 60_000, 1_000)),
    storeMaxKeys: Math.floor(optionalNumber(EnvKeys.RATE_LIMIT_STORE_MAX_KEYS, 5_000, 100)),
    tenantCacheTtlMs: Math.floor(optionalNumber(EnvKeys.RATE_LIMIT_TENANT_CACHE_TTL_MS, 60_000, 1_000)),
    tenantCacheMaxKeys: Math.floor(optionalNumber(EnvKeys.RATE_LIMIT_TENANT_CACHE_MAX_KEYS, 1_000, 10)),
    policies: {
      global: {
        ratePerSecond: globalRps,
        burst: optionalNumber(EnvKeys.RATE_LIMIT_GLOBAL_BURST, 15, 1),
      },
      tenant: {
        ratePerSecond: tenantRps,
        burst: optionalNumber(EnvKeys.RATE_LIMIT_TENANT_BURST, 10, 1),
      },
      user: {
        ratePerSecond: userRps,
        burst: optionalNumber(EnvKeys.RATE_LIMIT_USER_BURST, 10, 1),
      },
      write: perMinute(optionalNumber(EnvKeys.RATE_LIMIT_WRITE_PER_MINUTE, 30, 1), 5),
      expensive: perMinute(optionalNumber(EnvKeys.RATE_LIMIT_EXPENSIVE_PER_MINUTE, 10, 1), 3),
      report: perMinute(optionalNumber(EnvKeys.RATE_LIMIT_REPORT_PER_MINUTE, 3, 1), 2),
      dast: perMinute(optionalNumber(EnvKeys.RATE_LIMIT_DAST_PER_MINUTE, 2, 1), 2),
      "auth-login-ip": {
        ratePerSecond: optionalNumber(EnvKeys.RATE_LIMIT_LOGIN_IP_MAX, 20, 1) / authWindowSeconds,
        burst: optionalNumber(EnvKeys.RATE_LIMIT_LOGIN_IP_MAX, 20, 1),
      },
      "auth-login-account": {
        ratePerSecond: optionalNumber(EnvKeys.RATE_LIMIT_LOGIN_ACCOUNT_MAX, 5, 1) / authWindowSeconds,
        burst: optionalNumber(EnvKeys.RATE_LIMIT_LOGIN_ACCOUNT_MAX, 5, 1),
      },
      "auth-register-ip": {
        ratePerSecond: optionalNumber(EnvKeys.RATE_LIMIT_REGISTER_IP_MAX, 5, 1) / authWindowSeconds,
        burst: optionalNumber(EnvKeys.RATE_LIMIT_REGISTER_IP_MAX, 5, 1),
      },
      "auth-refresh": perMinute(optionalNumber(EnvKeys.RATE_LIMIT_REFRESH_PER_MINUTE, 10, 1), 3),
    },
  });
}

/** Cria uma cópia configurável para teste, sem ler ou alterar process.env. */
export function createRateLimitConfig(overrides: RateLimitConfigOverrides = {}): RateLimitConfig {
  const defaults: RateLimitConfig = {
    enabled: true,
    trustProxyHops: 0,
    storeTtlMs: 10 * 60_000,
    storeMaxKeys: 5_000,
    tenantCacheTtlMs: 60_000,
    tenantCacheMaxKeys: 1_000,
    policies: {
      global: { ratePerSecond: 5, burst: 15 },
      tenant: { ratePerSecond: 2, burst: 10 },
      user: { ratePerSecond: 1, burst: 10 },
      write: perMinute(30, 5),
      expensive: perMinute(10, 3),
      report: perMinute(3, 2),
      dast: perMinute(2, 2),
      "auth-login-ip": perMinute(4, 20),
      "auth-login-account": perMinute(1, 5),
      "auth-register-ip": perMinute(1, 5),
      "auth-refresh": perMinute(10, 3),
    },
  };

  return {
    ...defaults,
    ...overrides,
    policies: { ...defaults.policies, ...overrides.policies },
  };
}
