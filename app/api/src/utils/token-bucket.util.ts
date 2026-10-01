/**
 * token-bucket.util.ts
 *
 * Implementa o store em memória usado pelo rate limiter da instância única.
 * Existe separado do Express para manter o algoritmo determinístico e testável.
 * Consumido por RateLimitService; não conhece HTTP, banco ou autenticação.
 */

import { performance } from "node:perf_hooks";
import type { TokenBucketPolicy } from "../config/rate-limit.config";

interface BucketState {
  tokens: number;
  lastRefillMs: number;
  lastTouchedMs: number;
}

export interface TokenBucketResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  resetAfterSeconds: number;
  limit: number;
}

export interface TokenBucketStoreOptions {
  ttlMs: number;
  maxKeys: number;
  nowMs?: () => number;
}

export interface TokenBucketConsumeOptions {
  /** Preserva lockouts existentes quando o teto é alcançado, sem crescer memória. */
  rejectNewAtCapacity?: boolean;
}

/**
 * Store O(1) no caminho normal. A varredura para remover a chave mais antiga
 * só acontece quando o teto defensivo de chaves é alcançado.
 */
export class TokenBucketStore {
  private readonly buckets = new Map<string, BucketState>();
  private readonly nowMs: () => number;
  private readonly cleanupTimer: NodeJS.Timeout;

  constructor(private readonly options: TokenBucketStoreOptions) {
    this.nowMs = options.nowMs ?? (() => performance.now());
    // A limpeza não pode manter o processo Node vivo sozinha. Também há limpeza
    // sob demanda no limite de chaves, para que clocks injetados continuem
    // determinísticos nos testes.
    this.cleanupTimer = setInterval(() => this.cleanup(), Math.min(options.ttlMs, 60_000));
    this.cleanupTimer.unref();
  }

  consume(key: string, policy: TokenBucketPolicy, options: TokenBucketConsumeOptions = {}): TokenBucketResult {
    const now = this.nowMs();
    let bucket = this.buckets.get(key);

    if (!bucket) {
      if (!this.ensureCapacity(now, options.rejectNewAtCapacity ?? false)) {
        const retryAfterSeconds = Math.max(1, Math.ceil(this.options.ttlMs / 1_000));
        return { allowed: false, remaining: 0, retryAfterSeconds, resetAfterSeconds: retryAfterSeconds, limit: policy.burst };
      }
      bucket = { tokens: policy.burst, lastRefillMs: now, lastTouchedMs: now };
      this.buckets.set(key, bucket);
    }

    const elapsed = Math.max(0, now - bucket.lastRefillMs);
    bucket.tokens = Math.min(policy.burst, bucket.tokens + (elapsed / 1_000) * policy.ratePerSecond);
    bucket.lastRefillMs = now;
    bucket.lastTouchedMs = now;

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return {
        allowed: true,
        remaining: Math.floor(bucket.tokens),
        retryAfterSeconds: 0,
        resetAfterSeconds: this.resetAfterSeconds(bucket.tokens, policy),
        limit: policy.burst,
      };
    }

    const secondsUntilOneToken = (1 - bucket.tokens) / policy.ratePerSecond;
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil(secondsUntilOneToken)),
      resetAfterSeconds: this.resetAfterSeconds(bucket.tokens, policy),
      limit: policy.burst,
    };
  }

  /** Devolve um token reservado, usado somente para login que terminou em sucesso. */
  refund(key: string, policy: TokenBucketPolicy): void {
    const bucket = this.buckets.get(key);
    if (!bucket) return;
    bucket.tokens = Math.min(policy.burst, bucket.tokens + 1);
    bucket.lastTouchedMs = this.nowMs();
  }

  cleanup(): void {
    const now = this.nowMs();
    for (const [key, bucket] of this.buckets) {
      if (now - bucket.lastTouchedMs >= this.options.ttlMs) this.buckets.delete(key);
    }
  }

  reset(): void {
    this.buckets.clear();
  }

  dispose(): void {
    clearInterval(this.cleanupTimer);
    this.buckets.clear();
  }

  size(): number {
    return this.buckets.size;
  }

  private ensureCapacity(now: number, rejectNewAtCapacity: boolean): boolean {
    if (this.buckets.size < this.options.maxKeys) return true;
    this.cleanup();
    if (this.buckets.size < this.options.maxKeys) return true;
    if (rejectNewAtCapacity) return false;

    let oldestKey: string | undefined;
    let oldestTouched = now;
    for (const [key, bucket] of this.buckets) {
      // Tentativas em escopos comuns não podem apagar um lockout de autenticação
      // antes do TTL. Se só restarem buckets protegidos, a nova chave é recusada.
      if (key.startsWith("auth-")) continue;
      if (bucket.lastTouchedMs <= oldestTouched) {
        oldestKey = key;
        oldestTouched = bucket.lastTouchedMs;
      }
    }
    if (!oldestKey) return false;
    this.buckets.delete(oldestKey);
    return true;
  }

  private resetAfterSeconds(tokens: number, policy: TokenBucketPolicy): number {
    if (tokens >= policy.burst) return 0;
    return Math.max(1, Math.ceil((policy.burst - tokens) / policy.ratePerSecond));
  }
}
