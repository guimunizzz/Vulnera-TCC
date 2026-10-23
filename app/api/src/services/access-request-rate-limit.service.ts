/**
 * Mantém buckets independentes para as operações públicas de AccessRequest.
 * Existe para limitar abuso mesmo quando o limiter global está desligado;
 * é consumido pelo middleware de proteção antes da camada de controllers.
 */

import { createHash } from "node:crypto";
import type { AccessRequestRateLimitConfig } from "../config/access-request-rate-limit.config";
import { normalizeAccessRequestEmail } from "../models/access-request.model";
import { TokenBucketStore, type TokenBucketResult } from "../utils/token-bucket.util";

export type AccessRequestRateLimitAction = "request" | "resend" | "verify";

const EMAIL_COOLDOWN_SCOPE = "access-request:email-cooldown";

export class AccessRequestRateLimitService {
  readonly store: TokenBucketStore;
  readonly effectiveStoreTtlMs: number;

  constructor(
    private readonly config: AccessRequestRateLimitConfig,
    store?: TokenBucketStore,
  ) {
    this.effectiveStoreTtlMs = Math.max(config.storeTtlMs, minimumTtlMs(config));
    this.store = store ?? new TokenBucketStore({
      ttlMs: this.effectiveStoreTtlMs,
      maxKeys: config.storeMaxKeys,
    });
  }

  consumeIp(action: AccessRequestRateLimitAction, ip: string): TokenBucketResult {
    const policy = this.config.policies[`${action}Ip`];
    return this.store.consume(`access-request:${action}:ip:${fingerprint(ip)}`, policy, {
      // Saturação não pode expulsar uma identidade com orçamento esgotado.
      rejectNewAtCapacity: true,
    });
  }

  consumeEmail(email: string): TokenBucketResult {
    const normalizedEmail = normalizeAccessRequestEmail(email);
    const digest = fingerprint(normalizedEmail);
    const rateKey = `access-request:email-rate:${digest}`;
    const ratePolicy = this.config.policies.email;
    const rateResult = this.store.consume(rateKey, ratePolicy, { rejectNewAtCapacity: true });
    if (!rateResult.allowed) return rateResult;

    const cooldownPolicy = {
      burst: 1,
      ratePerSecond: 1_000 / this.config.emailCooldownMs,
    };
    const cooldownKey = `${EMAIL_COOLDOWN_SCOPE}:${digest}`;
    const cooldownResult = this.store.consume(cooldownKey, cooldownPolicy, { rejectNewAtCapacity: true });
    if (!cooldownResult.allowed) {
      // Recusa de cooldown não deve gastar também a quota de frequência.
      this.store.refund(rateKey, ratePolicy);
      return cooldownResult;
    }

    return rateResult;
  }

  dispose(): void {
    this.store.dispose();
  }
}

function minimumTtlMs(config: AccessRequestRateLimitConfig): number {
  const policies = Object.values(config.policies);
  for (const policy of policies) {
    if (!Number.isFinite(policy.ratePerSecond) || policy.ratePerSecond <= 0
      || !Number.isFinite(policy.burst) || policy.burst < 1) {
      throw new Error("INVALID_ACCESS_REQUEST_RATE_LIMIT_POLICY");
    }
  }
  if (!Number.isFinite(config.emailCooldownMs) || config.emailCooldownMs < 1) {
    throw new Error("INVALID_ACCESS_REQUEST_EMAIL_COOLDOWN");
  }

  const fullRefillMs = policies.map((policy) => Math.ceil(policy.burst / policy.ratePerSecond * 1_000));
  fullRefillMs.push(config.emailCooldownMs);
  return Math.max(...fullRefillMs);
}

function fingerprint(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
