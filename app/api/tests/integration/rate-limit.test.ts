/**
 * rate-limit.test.ts
 *
 * Exercita rate limiting por HTTP com store e relógio injetados. Consome a
 * API real, mas não usa timers falsos globais porque DAST depende deles.
 */

import request from "supertest";
import { createApp } from "../../src/app";
import { createRateLimitConfig, type TokenBucketPolicy } from "../../src/config/rate-limit.config";
import { UserRepository } from "../../src/repositories/user.repository";
import { RateLimitService, TenantRateLimitResolver } from "../../src/services/rate-limit.service";
import { TokenBucketStore } from "../../src/utils/token-bucket.util";
import { signAccessToken } from "../../src/utils/jwt.util";
import { prisma } from "../../src/database/prisma.database";
import { cleanDatabase } from "../setup";
import { seedUser } from "../fixtures/users.fixture";

type Clock = { now: number };

const HIGH: TokenBucketPolicy = { ratePerSecond: 100, burst: 100 };

function makeLimitedApp(policies: Partial<Record<string, TokenBucketPolicy>> = {}, clock: Clock = { now: 0 }) {
  const config = createRateLimitConfig({
    storeTtlMs: 60_000,
    storeMaxKeys: 100,
    tenantCacheTtlMs: 60_000,
    tenantCacheMaxKeys: 100,
    policies: {
      global: HIGH,
      tenant: HIGH,
      user: HIGH,
      write: HIGH,
      expensive: HIGH,
      report: HIGH,
      dast: HIGH,
      "auth-login-ip": HIGH,
      "auth-login-account": HIGH,
      "auth-register-ip": HIGH,
      "auth-refresh": HIGH,
      ...policies,
    },
  });
  const store = new TokenBucketStore({ ttlMs: config.storeTtlMs, maxKeys: config.storeMaxKeys, nowMs: () => clock.now });
  const resolver = new TenantRateLimitResolver(
    new UserRepository(prisma),
    config.tenantCacheTtlMs,
    config.tenantCacheMaxKeys,
    () => clock.now,
  );
  const service = new RateLimitService(config, resolver, store);

  return { app: createApp({ rateLimitService: service }), service, clock };
}

function bearer(userId: string, role: "ADMIN" | "CLIENT" | "PENTESTER" = "CLIENT"): string {
  return `Bearer ${signAccessToken({ userId, role })}`;
}

async function createCompany(name: string): Promise<string> {
  const plan = await prisma.plan.create({
    data: { name: `Plan ${name}`, maxApplications: 10, maxProjects: 10, includesRemediation: true, price: 0 },
  });
  const company = await prisma.company.create({ data: { name, planId: plan.id } });
  return company.id;
}

describe("Rate limiting HTTP multi-tenant", () => {
  let service: RateLimitService | undefined;

  beforeEach(async () => {
    await cleanDatabase();
  });

  afterEach(() => {
    service?.dispose();
    service = undefined;
  });

  it("limita endpoint público sem JWT e mantém /health fora do bucket global", async () => {
    const setup = makeLimitedApp({ global: { ratePerSecond: 0.001, burst: 1 } });
    service = setup.service;

    expect((await request(setup.app).get("/api/plans")).status).toBe(200);
    expect((await request(setup.app).get("/api/plans")).status).toBe(429);
    expect((await request(setup.app).get("/api/health")).status).toBe(200);
  });

  it("compartilha o bucket da mesma empresa, mas não cria tenant:null", async () => {
    const companyId = await createCompany("Empresa Rate Limit");
    const first = await seedUser({ name: "Cliente 1", email: "client1@limit.local", password: "senha12345", role: "CLIENT", companyId });
    const second = await seedUser({ name: "Cliente 2", email: "client2@limit.local", password: "senha12345", role: "CLIENT", companyId });
    const withoutCompany = await seedUser({ name: "Sem Empresa", email: "none@limit.local", password: "senha12345", role: "CLIENT" });
    const otherWithoutCompany = await seedUser({ name: "Sem Empresa 2", email: "none2@limit.local", password: "senha12345", role: "CLIENT" });
    const setup = makeLimitedApp({ tenant: { ratePerSecond: 0.001, burst: 2 } });
    service = setup.service;

    expect((await request(setup.app).get("/api/users/me").set("Authorization", bearer(first.id))).status).toBe(200);
    expect((await request(setup.app).get("/api/users/me").set("Authorization", bearer(second.id))).status).toBe(200);
    const blocked = await request(setup.app).get("/api/users/me").set("Authorization", bearer(first.id));
    expect(blocked.status).toBe(429);
    expect(blocked.headers["retry-after"]).toBe("1000");
    expect(blocked.body).toMatchObject({ code: "RATE_LIMITED", retryAfterSeconds: 1000 });
    expect(JSON.stringify(blocked.headers)).not.toContain(companyId);
    expect(JSON.stringify(blocked.body)).not.toContain(first.id);

    expect((await request(setup.app).get("/api/users/me").set("Authorization", bearer(withoutCompany.id))).status).toBe(200);
    expect((await request(setup.app).get("/api/users/me").set("Authorization", bearer(otherWithoutCompany.id))).status).toBe(200);
  });

  it("ignora tentativa de escolher tenant por header, query ou body", async () => {
    const companyId = await createCompany("Empresa Protegida");
    const client = await seedUser({ name: "Cliente", email: "spoof@limit.local", password: "senha12345", role: "CLIENT", companyId });
    const setup = makeLimitedApp({ tenant: { ratePerSecond: 0.001, burst: 1 } });
    service = setup.service;

    expect(
      (await request(setup.app)
        .get("/api/users/me?companyId=falsa")
        .set("Authorization", bearer(client.id))
        .set("X-Tenant-ID", "falsa")
        .send({ companyId: "falsa" })).status,
    ).toBe(200);
    expect((await request(setup.app).get("/api/users/me").set("Authorization", bearer(client.id))).status).toBe(429);
  });

  it("reabastece usuário com clock injetado e expõe headers padronizados", async () => {
    const actor = await seedUser({ name: "Relógio", email: "clock@limit.local", password: "senha12345", role: "CLIENT" });
    const clock = { now: 0 };
    const setup = makeLimitedApp({ user: { ratePerSecond: 1, burst: 1 } }, clock);
    service = setup.service;

    const accepted = await request(setup.app).get("/api/users/me").set("Authorization", bearer(actor.id));
    expect(accepted.status).toBe(200);
    expect(accepted.headers["ratelimit-limit"]).toBe("1");
    expect(accepted.headers["ratelimit-remaining"]).toBe("0");

    expect((await request(setup.app).get("/api/users/me").set("Authorization", bearer(actor.id))).status).toBe(429);
    clock.now += 1_000;
    expect((await request(setup.app).get("/api/users/me").set("Authorization", bearer(actor.id))).status).toBe(200);
  });

  it("limita falhas de login por conta sem revelar se ela existe", async () => {
    const actor = await seedUser({ name: "Login", email: "login@limit.local", password: "senha12345", role: "CLIENT" });
    const setup = makeLimitedApp({ "auth-login-account": { ratePerSecond: 0.001, burst: 2 } });
    service = setup.service;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await request(setup.app).post("/api/auth/login").send({ email: actor.email, password: "incorreta" });
      expect(response).toMatchObject({ status: 401, body: { code: "INVALID_CREDENTIALS" } });
    }
    const blocked = await request(setup.app).post("/api/auth/login").send({ email: actor.email, password: "incorreta" });
    expect(blocked.status).toBe(429);
    expect(JSON.stringify(blocked.body)).not.toContain(actor.email);
  });

  it("mantém usuários, ADMIN e PENTESTER fora de um tenant nulo compartilhado", async () => {
    const first = await seedUser({ name: "Usuário A", email: "user-a@limit.local", password: "senha12345", role: "CLIENT" });
    const second = await seedUser({ name: "Usuário B", email: "user-b@limit.local", password: "senha12345", role: "CLIENT" });
    const admin = await seedUser({ name: "Admin", email: "admin@limit.local", password: "senha12345", role: "ADMIN" });
    const pentester = await seedUser({ name: "Pentester", email: "pentester@limit.local", password: "senha12345", role: "PENTESTER" });
    const setup = makeLimitedApp({ user: { ratePerSecond: 0.001, burst: 1 }, tenant: { ratePerSecond: 0.001, burst: 1 } });
    service = setup.service;

    expect((await request(setup.app).get("/api/users/me").set("Authorization", bearer(first.id))).status).toBe(200);
    expect((await request(setup.app).get("/api/users/me").set("Authorization", bearer(second.id))).status).toBe(200);
    expect((await request(setup.app).get("/api/users/me").set("Authorization", bearer(admin.id, "ADMIN"))).status).toBe(200);
    expect((await request(setup.app).get("/api/users/me").set("Authorization", bearer(pentester.id, "PENTESTER"))).status).toBe(200);
  });

  it("aplica buckets de escrita, consulta cara, relatório e criação DAST", async () => {
    const client = await seedUser({ name: "Cliente limite", email: "policies@limit.local", password: "senha12345", role: "CLIENT" });
    const pentester = await seedUser({ name: "Pentester limite", email: "dast@limit.local", password: "senha12345", role: "PENTESTER" });
    const setup = makeLimitedApp({
      write: { ratePerSecond: 0.001, burst: 1 },
      expensive: { ratePerSecond: 0.001, burst: 1 },
      report: { ratePerSecond: 0.001, burst: 1 },
      dast: { ratePerSecond: 0.001, burst: 1 },
    });
    service = setup.service;

    const clientAuth = bearer(client.id);
    expect((await request(setup.app).post("/api/notifications/register-push").set("Authorization", clientAuth).send({ expoPushToken: "ExponentPushToken[one]" })).status).toBe(204);
    expect((await request(setup.app).post("/api/notifications/register-push").set("Authorization", clientAuth).send({ expoPushToken: "ExponentPushToken[two]" })).status).toBe(429);

    expect((await request(setup.app).get("/api/vulnerabilities").set("Authorization", clientAuth)).status).not.toBe(429);
    expect((await request(setup.app).get("/api/vulnerabilities").set("Authorization", clientAuth)).status).toBe(429);
    expect((await request(setup.app).get("/api/reports").set("Authorization", clientAuth)).status).toBe(400);
    expect((await request(setup.app).get("/api/reports").set("Authorization", clientAuth)).status).toBe(429);

    const pentesterAuth = bearer(pentester.id, "PENTESTER");
    expect((await request(setup.app).post("/api/dast/scans").set("Authorization", pentesterAuth).send({})).status).toBe(400);
    expect((await request(setup.app).post("/api/dast/scans").set("Authorization", pentesterAuth).send({})).status).toBe(429);
  });

  it("limita register, refresh rotativo e reembolsa login bem-sucedido", async () => {
    const actor = await seedUser({ name: "Sessão", email: "session@limit.local", password: "senha12345", role: "CLIENT" });
    const setup = makeLimitedApp({
      "auth-register-ip": { ratePerSecond: 0.001, burst: 1 },
      "auth-refresh": { ratePerSecond: 0.001, burst: 1 },
      "auth-login-ip": { ratePerSecond: 0.001, burst: 1 },
      "auth-login-account": { ratePerSecond: 0.001, burst: 1 },
    });
    service = setup.service;

    expect((await request(setup.app).post("/api/auth/register").send({})).status).toBe(400);
    expect((await request(setup.app).post("/api/auth/register").send({})).status).toBe(429);

    const firstLogin = await request(setup.app).post("/api/auth/login").send({ email: actor.email, password: "senha12345" });
    const secondLogin = await request(setup.app).post("/api/auth/login").send({ email: actor.email, password: "senha12345" });
    expect(firstLogin.status).toBe(200);
    expect(secondLogin.status).toBe(200);

    const firstRefresh = await request(setup.app).post("/api/auth/refresh").send({ refreshToken: firstLogin.body.refreshToken });
    expect(firstRefresh.status).toBe(200);
    expect((await request(setup.app).post("/api/auth/refresh").send({ refreshToken: firstRefresh.body.refreshToken })).status).toBe(429);
  });
});
