// Define limites próprios para validação e consumo de convites.
// Existe para manter a proteção ativa mesmo quando o limiter geral é desligado.
// Consumido pela factory do fluxo público de ativação.

import type { TokenBucketPolicy } from "./rate-limit.config";
import { EnvVar } from "./EnvVar";
import { EnvKeys } from "./enum/EnvKeys";

const MINUTE_MS = 60_000;

export type AccountActivationRateLimitConfig = {
  storeTtlMs: number;
  storeMaxKeys: number;
  policies: {
    validateIp: TokenBucketPolicy;
    validateToken: TokenBucketPolicy;
    activateIp: TokenBucketPolicy;
    activateToken: TokenBucketPolicy;
  };
};

export function loadAccountActivationRateLimitConfig(): AccountActivationRateLimitConfig {
  const policies = {
    validateIp: perMinute(EnvKeys.RATE_LIMIT_ACCOUNT_ACTIVATION_VALIDATE_IP_PER_MINUTE, 30),
    validateToken: perMinute(EnvKeys.RATE_LIMIT_ACCOUNT_ACTIVATION_VALIDATE_TOKEN_PER_MINUTE, 30),
    activateIp: perMinute(EnvKeys.RATE_LIMIT_ACCOUNT_ACTIVATION_ACTIVATE_IP_PER_MINUTE, 5),
    activateToken: perMinute(EnvKeys.RATE_LIMIT_ACCOUNT_ACTIVATION_ACTIVATE_TOKEN_PER_MINUTE, 5),
  };

  const fullRefillMs = Object.values(policies).map((policy) =>
    Math.ceil((policy.burst / policy.ratePerSecond) * 1_000),
  );

  return {
    // O store não pode remover uma chave antes de o bucket correspondente reabastecer.
    storeTtlMs: Math.max(MINUTE_MS, ...fullRefillMs),
    storeMaxKeys: integer(EnvKeys.RATE_LIMIT_ACCOUNT_ACTIVATION_STORE_MAX_KEYS, 5_000, 100, 1_000_000),
    policies,
  };
}

function perMinute(key: EnvKeys, fallback: number): TokenBucketPolicy {
  const burst = integer(key, fallback, 1, 100_000);
  return { burst, ratePerSecond: burst / 60 };
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
