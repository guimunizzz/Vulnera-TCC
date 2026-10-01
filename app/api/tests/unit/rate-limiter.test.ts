/**
 * rate-limiter.test.ts
 *
 * Valida o Token Bucket sem relógio real para provar burst, refill, expiração
 * e isolamento de chaves. Consumido pelo gate Jest da funcionalidade.
 */

import { TokenBucketStore } from "../../src/utils/token-bucket.util";
import type { TokenBucketPolicy } from "../../src/config/rate-limit.config";

const POLICY: TokenBucketPolicy = { ratePerSecond: 1, burst: 2 };

describe("TokenBucketStore", () => {
  let now = 0;
  let store: TokenBucketStore;

  beforeEach(() => {
    now = 0;
    store = new TokenBucketStore({ ttlMs: 1_000, maxKeys: 3, nowMs: () => now });
  });

  afterEach(() => {
    store.dispose();
  });

  it("aceita o burst, bloqueia o excedente e informa Retry-After", () => {
    expect(store.consume("user:one", POLICY)).toMatchObject({ allowed: true, remaining: 1 });
    expect(store.consume("user:one", POLICY)).toMatchObject({ allowed: true, remaining: 0 });
    expect(store.consume("user:one", POLICY)).toMatchObject({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 1,
      limit: 2,
    });
  });

  it("reabastece parcialmente e totalmente sem sleep", () => {
    store.consume("user:one", POLICY);
    store.consume("user:one", POLICY);

    now += 500;
    expect(store.consume("user:one", POLICY)).toMatchObject({ allowed: false, retryAfterSeconds: 1 });

    now += 500;
    expect(store.consume("user:one", POLICY)).toMatchObject({ allowed: true, remaining: 0 });

    now += 2_000;
    expect(store.consume("user:one", POLICY)).toMatchObject({ allowed: true, remaining: 1 });
  });

  it("mantém chaves independentes e não retrocede quando o relógio muda", () => {
    expect(store.consume("tenant:a", POLICY).allowed).toBe(true);
    expect(store.consume("tenant:b", POLICY).allowed).toBe(true);

    now -= 100;
    expect(store.consume("tenant:a", POLICY).allowed).toBe(true);
    expect(store.consume("tenant:a", POLICY).allowed).toBe(false);
    expect(store.consume("tenant:b", POLICY).allowed).toBe(true);
  });

  it("remove buckets ociosos e respeita o teto de memória", () => {
    store.consume("key:one", POLICY);
    store.consume("key:two", POLICY);
    store.consume("key:three", POLICY);
    expect(store.size()).toBe(3);

    store.consume("key:four", POLICY);
    expect(store.size()).toBe(3);

    now += 1_000;
    store.cleanup();
    expect(store.size()).toBe(0);
  });

  it("preserva lockout de autenticação quando o teto recusa fingerprints novos", () => {
    const protectedStore = new TokenBucketStore({ ttlMs: 1_000, maxKeys: 1, nowMs: () => now });
    try {
      expect(protectedStore.consume("auth-login-account:target", POLICY).allowed).toBe(true);
      const flood = protectedStore.consume("user:attacker", POLICY);
      expect(flood).toMatchObject({ allowed: false, retryAfterSeconds: 1 });
      expect(protectedStore.consume("auth-login-account:target", POLICY).allowed).toBe(true);
    } finally {
      protectedStore.dispose();
    }
  });

  it("permanece seguro sob chamadas simultâneas no mesmo event loop", async () => {
    const results = await Promise.all(
      Array.from({ length: 8 }, () => Promise.resolve(store.consume("user:parallel", POLICY).allowed)),
    );

    expect(results.filter(Boolean)).toHaveLength(2);
    expect(store.size()).toBe(1);
  });
});
