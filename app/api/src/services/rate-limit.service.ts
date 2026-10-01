/**
 * rate-limit.service.ts
 *
 * Orquestra os buckets de infraestrutura e resolve o tenant somente quando a
 * identidade é confiável. Consumido pelos middlewares; não participa de RBAC
 * nem ownership, que continuam sendo decisão dos services de domínio.
 */

import { createHash } from "node:crypto";
import type { JwtPayload } from "../utils/jwt.util";
import type { RateLimitConfig, RateLimitScope } from "../config/rate-limit.config";
import { TokenBucketStore, type TokenBucketResult } from "../utils/token-bucket.util";
import type { UserRepository } from "../repositories/user.repository";

interface TenantCacheEntry {
  companyId: string | null;
  expiresAt: number;
  lastTouchedAt: number;
}

/** Cache curto dedicado a bucket de rate limit; jamais é usado para autorização. */
export class TenantRateLimitResolver {
  private readonly cache = new Map<string, TenantCacheEntry>();
  private readonly cleanupTimer: NodeJS.Timeout;

  constructor(
    private readonly users: UserRepository,
    private readonly ttlMs: number,
    private readonly maxKeys: number,
    private readonly nowMs: () => number = () => Date.now(),
  ) {
    this.cleanupTimer = setInterval(() => this.cleanup(this.nowMs()), Math.min(ttlMs, 60_000));
    this.cleanupTimer.unref();
  }

  async resolve(actor: JwtPayload): Promise<string | null> {
    // PENTESTER pode atravessar companies por ProjectMember e ADMIN é global:
    // ambos continuam nos buckets global + user + endpoint, nunca tenant:null.
    if (actor.role !== "CLIENT") return null;

    const now = this.nowMs();
    this.cleanup(now);
    const cached = this.cache.get(actor.userId);
    if (cached && cached.expiresAt > now) {
      cached.lastTouchedAt = now;
      return cached.companyId;
    }

    const companyId = await this.users.findCompanyIdById(actor.userId);
    this.ensureCapacity(now);
    this.cache.set(actor.userId, {
      companyId,
      expiresAt: now + this.ttlMs,
      lastTouchedAt: now,
    });
    return companyId;
  }

  reset(): void {
    this.cache.clear();
  }

  dispose(): void {
    clearInterval(this.cleanupTimer);
    this.cache.clear();
  }

  private cleanup(now: number): void {
    for (const [key, value] of this.cache) {
      if (value.expiresAt <= now) this.cache.delete(key);
    }
  }

  private ensureCapacity(now: number): void {
    if (this.cache.size < this.maxKeys) return;
    this.cleanup(now);
    if (this.cache.size < this.maxKeys) return;
    let oldestKey: string | undefined;
    let oldestTouched = now;
    for (const [key, value] of this.cache) {
      if (value.lastTouchedAt <= oldestTouched) {
        oldestKey = key;
        oldestTouched = value.lastTouchedAt;
      }
    }
    if (oldestKey) this.cache.delete(oldestKey);
  }
}

export class RateLimitService {
  readonly store: TokenBucketStore;

  constructor(
    readonly config: RateLimitConfig,
    private readonly tenantResolver: TenantRateLimitResolver,
    store?: TokenBucketStore,
  ) {
    this.store = store ?? new TokenBucketStore({ ttlMs: config.storeTtlMs, maxKeys: config.storeMaxKeys });
  }

  consume(scope: RateLimitScope, key: string): TokenBucketResult {
    if (!this.config.enabled) {
      const policy = this.config.policies[scope];
      return { allowed: true, remaining: policy.burst, retryAfterSeconds: 0, resetAfterSeconds: 0, limit: policy.burst };
    }
    return this.store.consume(`${scope}:${key}`, this.config.policies[scope], {
      // Ao lotar a memória, fingerprints novos de autenticação são recusados
      // em vez de expulsar uma conta já bloqueada e permitir brute force.
      rejectNewAtCapacity: scope.startsWith("auth-"),
    });
  }

  refund(scope: RateLimitScope, key: string): void {
    if (this.config.enabled) this.store.refund(`${scope}:${key}`, this.config.policies[scope]);
  }

  async resolveTenant(actor: JwtPayload): Promise<string | null> {
    return this.tenantResolver.resolve(actor);
  }

  reset(): void {
    this.store.reset();
    this.tenantResolver.reset();
  }

  dispose(): void {
    this.store.dispose();
    this.tenantResolver.dispose();
  }

  static fingerprint(value: string): string {
    return createHash("sha256").update(value).digest("hex");
  }
}
