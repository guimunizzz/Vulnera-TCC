// Configura buckets isolados para os endpoints públicos de AccessRequest.
// Impede que desligar o limiter geral também desligue a proteção deste fluxo.
// Consumido pela factory do middleware público e por testes de configuração.

import type { TokenBucketPolicy } from "./rate-limit.config";
import { EnvVar } from "./EnvVar";
import { EnvKeys } from "./enum/EnvKeys";

const HOUR_MS = 60 * 60_000;
const DAY_MS = 24 * HOUR_MS;
const MAX_WINDOW_MS = 365 * DAY_MS;

export type AccessRequestRateLimitConfig = {
  storeTtlMs: number;
  storeMaxKeys: number;
  emailCooldownMs: number;
  policies: {
    requestIp: TokenBucketPolicy;
    resendIp: TokenBucketPolicy;
    verifyIp: TokenBucketPolicy;
    email: TokenBucketPolicy;
  };
};

export function loadAccessRequestRateLimitConfig(): AccessRequestRateLimitConfig {
  const policies = {
    requestIp: windowPolicy(
      EnvKeys.RATE_LIMIT_ACCESS_REQUEST_IP_MAX,
      EnvKeys.RATE_LIMIT_ACCESS_REQUEST_IP_WINDOW_MS,
      5,
      HOUR_MS,
    ),
    resendIp: windowPolicy(
      EnvKeys.RATE_LIMIT_ACCESS_RESEND_IP_MAX,
      EnvKeys.RATE_LIMIT_ACCESS_RESEND_IP_WINDOW_MS,
      10,
      HOUR_MS,
    ),
    verifyIp: windowPolicy(
      EnvKeys.RATE_LIMIT_ACCESS_VERIFY_IP_MAX,
      EnvKeys.RATE_LIMIT_ACCESS_VERIFY_IP_WINDOW_MS,
      30,
      60_000,
    ),
    email: windowPolicy(
      EnvKeys.RATE_LIMIT_ACCESS_EMAIL_MAX,
      EnvKeys.RATE_LIMIT_ACCESS_EMAIL_WINDOW_MS,
      5,
      DAY_MS,
    ),
  };
  const emailCooldownMs = integer(
    EnvKeys.ACCESS_REQUEST_RESEND_COOLDOWN_MS,
    60_000,
    1_000,
    DAY_MS,
  );
  const fullRefills = Object.values(policies).map((policy) =>
    Math.ceil((policy.burst / policy.ratePerSecond) * 1_000),
  );
  const storeTtlMs = Math.max(emailCooldownMs, ...fullRefills);

  return {
    storeTtlMs,
    storeMaxKeys: integer(EnvKeys.RATE_LIMIT_ACCESS_STORE_MAX_KEYS, 5_000, 100, 1_000_000),
    emailCooldownMs,
    policies,
  };
}

function windowPolicy(
  maxKey: EnvKeys,
  windowKey: EnvKeys,
  defaultMax: number,
  defaultWindowMs: number,
): TokenBucketPolicy {
  // MAX define o burst inicial; WINDOW_MS define o tempo para refill completo,
  // não uma janela fixa que zera a contagem em um limite de calendário.
  const burst = integer(maxKey, defaultMax, 1, 100_000);
  const windowMs = integer(windowKey, defaultWindowMs, 1_000, MAX_WINDOW_MS);
  return { burst, ratePerSecond: burst / (windowMs / 1_000) };
}

function integer(key: EnvKeys, fallback: number, minimum: number, maximum: number): number {
  const raw = EnvVar.getOptional(key, String(fallback));
  if (!/^(?:0|[1-9]\d*)$/u.test(raw)) throw new Error(`INVALID_${key}`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`INVALID_${key}`);
  }
  return value;
}
