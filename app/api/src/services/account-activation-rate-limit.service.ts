// Mantém buckets independentes por operação, IP e hash do convite.
// Existe para limitar tentativas sem depender do limiter geral da API.
// Consumido pelo middleware das rotas públicas de ativação.

import { createHash } from "node:crypto";
import type { AccountActivationRateLimitConfig } from "../config/account-activation-rate-limit.config";
import { TokenBucketStore, type TokenBucketResult } from "../utils/token-bucket.util";

export type AccountActivationRateLimitAction = "validate" | "activate";

export class AccountActivationRateLimitService {
  readonly store: TokenBucketStore;
  readonly effectiveStoreTtlMs: number;

  constructor(
    private readonly config: AccountActivationRateLimitConfig,
    store?: TokenBucketStore,
  ) {
    this.effectiveStoreTtlMs = Math.max(config.storeTtlMs, minimumTtlMs(config));
    this.store = store ?? new TokenBucketStore({
      ttlMs: this.effectiveStoreTtlMs,
      maxKeys: config.storeMaxKeys,
    });
  }

  consumeIp(action: AccountActivationRateLimitAction, ip: string): TokenBucketResult {
    const policy = action === "validate" ? this.config.policies.validateIp : this.config.policies.activateIp;
    return this.store.consume(`account-activation:${action}:ip:${fingerprint(ip)}`, policy, {
      rejectNewAtCapacity: true,
    });
  }

  consumeToken(action: AccountActivationRateLimitAction, token: string): TokenBucketResult {
    return this.store.consume(
      `account-activation:${action}:token:${fingerprint(token)}`,
      action === "validate" ? this.config.policies.validateToken : this.config.policies.activateToken,
      { rejectNewAtCapacity: true },
    );
  }

  dispose(): void {
    this.store.dispose();
  }
}

function minimumTtlMs(config: AccountActivationRateLimitConfig): number {
  const policies = Object.values(config.policies);
  for (const policy of policies) {
    if (!Number.isFinite(policy.ratePerSecond) || policy.ratePerSecond <= 0
      || !Number.isFinite(policy.burst) || policy.burst < 1) {
      throw new Error("INVALID_ACCOUNT_ACTIVATION_RATE_LIMIT_POLICY");
    }
  }
  if (!Number.isSafeInteger(config.storeMaxKeys) || config.storeMaxKeys < 1) {
    throw new Error("INVALID_ACCOUNT_ACTIVATION_RATE_LIMIT_STORE_CAPACITY");
  }
  if (!Number.isSafeInteger(config.storeTtlMs) || config.storeTtlMs < 1_000) {
    throw new Error("INVALID_ACCOUNT_ACTIVATION_RATE_LIMIT_STORE_TTL");
  }
  const fullRefillMs = policies.map((policy) => Math.ceil((policy.burst / policy.ratePerSecond) * 1_000));
  return Math.max(config.storeTtlMs, ...fullRefillMs);
}

function fingerprint(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
