/**
 * Verifica os endpoints públicos de solicitação e confirmação pelo app Express real.
 * Existe para proteger o contrato HTTP, as proteções e a composição com MySQL;
 * consome a API via Supertest com CAPTCHA e transporte de e-mail simulados.
 */

import request from "supertest";
import { createApp } from "../../src/app";
import { createRateLimitConfig } from "../../src/config/rate-limit.config";
import type { AccessRequestRouteDependencies } from "../../src/factories/access-request.factory";
import { makeRateLimitService } from "../../src/factories/rate-limit.factory";
import { AccessRequestRepository } from "../../src/repositories/access-request.repository";
import { AccessRequestRateLimitService } from "../../src/services/access-request-rate-limit.service";
import { AccessRequestService } from "../../src/services/access-request.service";
import { EmailVerificationService } from "../../src/services/email-verification.service";
import { TokenBucketStore } from "../../src/utils/token-bucket.util";
import { hashAccessToken } from "../../src/utils/access-token.util";
import { prisma } from "../../src/database/prisma.database";
import { FakeCaptchaVerifier } from "../fixtures/fake-captcha-verifier";
import { FakeEmailSender } from "../fixtures/fake-email-sender";
import { seedUser } from "../fixtures/users.fixture";
import { cleanDatabase } from "../setup";

const PUBLIC_WEB_URL = "https://app.vulnera.example";
const COOLDOWN_MS = 60_000;
const HOUR_MS = 60 * 60_000;
const DAY_MS = 24 * HOUR_MS;
const INITIAL_TIME = new Date("2026-10-23T12:00:00.000Z");
const NEUTRAL_RESPONSE = {
  message: "Se os dados informados permitirem, você receberá as instruções por e-mail.",
};
const INPUT = {
  name: "Pessoa solicitante",
  email: "  Nova-Pessoa@Empresa.Local  ",
  companyName: "Empresa declarada",
  phone: "11999990000",
};
const INVALID_REQUEST_CASES: Array<[string, Record<string, unknown>, string]> = [
  ["nome ausente", { email: "missing-name@empresa.local", companyName: "Empresa" }, "INVALID_NAME"],
  ["e-mail inválido", { ...INPUT, email: "not-an-email" }, "INVALID_EMAIL"],
  ["empresa ausente", { ...INPUT, companyName: " " }, "INVALID_COMPANY_NAME"],
  ["telefone com tipo inválido", { ...INPUT, phone: 42 }, "INVALID_PHONE"],
];

type PublicRateLimitOverrides = {
  requestIp?: { burst: number; ratePerSecond: number };
  resendIp?: { burst: number; ratePerSecond: number };
  verifyIp?: { burst: number; ratePerSecond: number };
  email?: { burst: number; ratePerSecond: number };
};

let now: Date;
let captcha: FakeCaptchaVerifier;
let sender: FakeEmailSender;
let publicLimiter: AccessRequestRateLimitService;
let globalRateLimit: ReturnType<typeof makeRateLimitService>;
let app: ReturnType<typeof createApp>;

function makePublicLimiter(overrides: PublicRateLimitOverrides = {}, storeTtlMs = 60_000) {
  const config = {
    storeTtlMs,
    storeMaxKeys: 1_000,
    emailCooldownMs: 1_000,
    policies: {
      requestIp: overrides.requestIp ?? { burst: 50, ratePerSecond: 50 },
      resendIp: overrides.resendIp ?? { burst: 50, ratePerSecond: 50 },
      verifyIp: overrides.verifyIp ?? { burst: 50, ratePerSecond: 50 },
      email: overrides.email ?? { burst: 50, ratePerSecond: 50 },
    },
  };
  const minimumTtlMs = Math.max(
    config.emailCooldownMs,
    ...Object.values(config.policies).map((policy) =>
      Math.ceil((policy.burst / policy.ratePerSecond) * 1_000)),
  );
  const store = new TokenBucketStore({
    ttlMs: Math.max(config.storeTtlMs, minimumTtlMs),
    maxKeys: config.storeMaxKeys,
    nowMs: () => now.getTime(),
  });
  return { limiter: new AccessRequestRateLimitService(config, store), store };
}

function configureApp(options: { emailSender?: FakeEmailSender; trustProxyHops?: number } = {}): void {
  globalRateLimit?.dispose();
  globalRateLimit = makeRateLimitService(createRateLimitConfig({
    enabled: false,
    trustProxyHops: options.trustProxyHops ?? 0,
  }));
  const repository = new AccessRequestRepository(prisma);
  const verification = new EmailVerificationService(
    repository,
    options.emailSender ?? sender,
    PUBLIC_WEB_URL,
    () => new Date(now),
  );
  const service = new AccessRequestService(repository, verification, {
    clock: () => new Date(now),
    cooldownMs: COOLDOWN_MS,
  });
  const accessRequestDependencies: AccessRequestRouteDependencies = {
    service,
    captchaVerifier: captcha,
    limiter: publicLimiter,
  };
  app = createApp({ rateLimitService: globalRateLimit, accessRequestDependencies });
}

function emailTokenFromMessage(message: { text: string }): string {
  const match = message.text.match(/#token=([A-Za-z0-9_-]{43})/u);
  expect(match).not.toBeNull();
  return match![1];
}

function postRequest(body: Record<string, unknown> = INPUT) {
  return request(app)
    .post("/api/access-requests")
    .send({ ...body, captchaToken: captcha.issueToken() });
}

function postResend(email: string, forwardedFor?: string) {
  const call = request(app)
    .post("/api/access-requests/resend-verification")
    .send({ email, captchaToken: captcha.issueToken() });
  return forwardedFor ? call.set("X-Forwarded-For", forwardedFor) : call;
}

function postConfirmation(token: string) {
  return request(app).post("/api/access-requests/verify-email").send({ token });
}

function postRequestFrom(email: string, forwardedFor?: string) {
  const call = request(app)
    .post("/api/access-requests")
    .send({ ...INPUT, email, captchaToken: captcha.issueToken() });
  return forwardedFor ? call.set("X-Forwarded-For", forwardedFor) : call;
}

async function activeRequest(email: string) {
  return prisma.accessRequest.findUnique({ where: { activeEmail: email.trim().toLowerCase() } });
}

beforeEach(async () => {
  await cleanDatabase();
  now = new Date(INITIAL_TIME);
  captcha = new FakeCaptchaVerifier({ nowMs: () => now.getTime() });
  sender = new FakeEmailSender();
  publicLimiter = makePublicLimiter().limiter;
  configureApp();
});

afterEach(() => {
  publicLimiter.dispose();
  globalRateLimit.dispose();
});

describe("HTTP público de AccessRequest", () => {
  it("cria um pedido normalizado, guarda só o hash do token e não cria identidade autenticada", async () => {
    const response = await postRequest({
      ...INPUT,
      role: "ADMIN",
      companyId: "company-injected",
      status: "APPROVED",
      activeEmail: "attacker@example.local",
      expiresAt: "2099-01-01T00:00:00.000Z",
      password: "must-not-be-used",
    }).expect(202);

    expect(response.body).toEqual(NEUTRAL_RESPONSE);
    const row = await activeRequest("nova-pessoa@empresa.local");
    expect(row).toMatchObject({
      name: INPUT.name,
      email: "nova-pessoa@empresa.local",
      companyName: INPUT.companyName,
      phone: INPUT.phone,
      status: "PENDING_EMAIL_VERIFICATION",
      activeEmail: "nova-pessoa@empresa.local",
      expiresAt: new Date(now.getTime() + 7 * DAY_MS),
    });
    expect(row!.id).toBeTruthy();
    const message = sender.messages[0];
    expect(message).toBeDefined();
    const rawToken = emailTokenFromMessage(message);
    const token = await prisma.emailVerificationToken.findUnique({
      where: { accessRequestId: row!.id },
    });
    expect(token).toMatchObject({
      tokenHash: hashAccessToken(rawToken),
      expiresAt: new Date(now.getTime() + HOUR_MS),
      usedAt: null,
      revokedAt: null,
    });
    expect(JSON.stringify(token)).not.toContain(rawToken);
    expect(response.body).not.toHaveProperty("id");
    expect(await Promise.all([
      prisma.user.count(),
      prisma.company.count(),
      prisma.subscription.count(),
      prisma.refreshToken.count(),
      prisma.auditLog.count(),
    ])).toEqual([0, 0, 0, 0, 0]);
  });

  it("mantém status e corpo neutros para pedido novo, duplicado, conta existente e reserva vencida", async () => {
    const first = await postRequest().expect(202);
    now = new Date(now.getTime() + 1_001);
    const duplicate = await postRequest({ ...INPUT, email: "NOVA-PESSOA@EMPRESA.LOCAL" }).expect(202);

    await seedUser({
      name: "Conta antiga",
      email: "existing-account@empresa.local",
      password: "Existing-account-test-password",
      role: "CLIENT",
    });
    const existingUser = await postRequest({ ...INPUT, email: "EXISTING-ACCOUNT@EMPRESA.LOCAL" }).expect(202);

    const oldCreatedAt = new Date(now.getTime() - 8 * DAY_MS);
    const expiredEmail = "expired-request@empresa.local";
    const expired = await new AccessRequestRepository(prisma).createIfEmailAvailable({
      name: "Tentativa anterior",
      email: expiredEmail,
      companyName: "Empresa anterior",
    }, oldCreatedAt);
    expect(expired).not.toBeNull();
    const expiredRequest = await postRequest({ ...INPUT, email: expiredEmail }).expect(202);

    for (const response of [first, duplicate, existingUser, expiredRequest]) {
      expect(response.body).toEqual(NEUTRAL_RESPONSE);
    }
    expect(await prisma.accessRequest.findUnique({ where: { id: expired!.id } }))
      .toMatchObject({ status: "EXPIRED", activeEmail: null });
    expect(await prisma.accessRequest.count({ where: { activeEmail: expiredEmail } })).toBe(1);
    expect(await prisma.user.count()).toBe(1);
  });

  it("não enumera reenvio sem pedido nem conta já existente", async () => {
    await seedUser({
      name: "Conta antiga",
      email: "resend-user@empresa.local",
      password: "Existing-account-test-password",
      role: "CLIENT",
    });
    const absent = await postResend("absent@empresa.local").expect(202);
    const existing = await postResend("RESEND-USER@EMPRESA.LOCAL").expect(202);

    expect(absent.body).toEqual(NEUTRAL_RESPONSE);
    expect(existing.body).toEqual(NEUTRAL_RESPONSE);
    expect(await prisma.accessRequest.count()).toBe(0);
    expect(sender.messages).toHaveLength(0);
  });

  it("recusa CAPTCHA ausente, inválido, expirado, repetido ou indisponível antes de gravar pedido", async () => {
    const missing = await request(app).post("/api/access-requests").send(INPUT).expect(400);
    const invalid = await request(app).post("/api/access-requests")
      .send({ ...INPUT, email: "invalid-captcha@empresa.local", captchaToken: "not-issued" })
      .expect(400);
    const validToken = captcha.issueToken();
    await request(app).post("/api/access-requests")
      .send({ ...INPUT, email: "captcha-replay@empresa.local", captchaToken: validToken })
      .expect(202);
    const replay = await request(app).post("/api/access-requests")
      .send({ ...INPUT, email: "captcha-replay@empresa.local", captchaToken: validToken })
      .expect(400);

    const expiringToken = captcha.issueToken();
    now = new Date(now.getTime() + 5 * 60_000);
    const expired = await request(app).post("/api/access-requests")
      .send({ ...INPUT, email: "captcha-expired@empresa.local", captchaToken: expiringToken })
      .expect(400);
    captcha.setFailure(true);
    const unavailable = await postRequest({ ...INPUT, email: "captcha-provider-failure@empresa.local" })
      .expect(400);

    expect(missing.body).toEqual({ code: "MISSING_CAPTCHA" });
    expect(invalid.body).toEqual({ code: "INVALID_CAPTCHA" });
    expect(replay.body).toEqual({ code: "INVALID_CAPTCHA" });
    expect(expired.body).toEqual({ code: "INVALID_CAPTCHA" });
    expect(unavailable.body).toEqual({ code: "INVALID_CAPTCHA" });
    expect(await prisma.accessRequest.count()).toBe(1);
  });

  it.each(INVALID_REQUEST_CASES)("valida %s no controller antes de criar reserva", async (_label, body, error) => {
    const response = await postRequest(body as Record<string, unknown>).expect(400);
    expect(response.body).toEqual({ error });
    expect(await prisma.accessRequest.count()).toBe(0);
    expect(sender.messages).toHaveLength(0);
  });

  it("valida o e-mail do endpoint de reenvio", async () => {
    const response = await postResend("not-an-email").expect(400);
    expect(response.body).toEqual({ error: "INVALID_EMAIL" });
    expect(await prisma.accessRequest.count()).toBe(0);
  });

  it("rotaciona reenvio após cooldown e mantém a mesma resposta durante o cooldown", async () => {
    const initial = await postRequest().expect(202);
    const row = await activeRequest("nova-pessoa@empresa.local");
    const originalToken = emailTokenFromMessage(sender.messages[0]);
    const originalHash = (await prisma.emailVerificationToken.findUnique({
      where: { accessRequestId: row!.id },
    }))!.tokenHash;
    now = new Date(now.getTime() + 1_001);
    const immediateResend = await postResend("NOVA-PESSOA@EMPRESA.LOCAL").expect(202);
    expect(immediateResend.body).toEqual(initial.body);
    expect(sender.messages).toHaveLength(1);
    expect((await prisma.emailVerificationToken.findUnique({ where: { accessRequestId: row!.id } }))?.tokenHash)
      .toBe(originalHash);

    now = new Date(now.getTime() + COOLDOWN_MS + 1);
    const resent = await postResend(" nova-pessoa@empresa.local ").expect(202);
    expect(resent.body).toEqual(NEUTRAL_RESPONSE);
    expect(sender.messages).toHaveLength(2);
    const replacementToken = emailTokenFromMessage(sender.messages[1]);
    const rotated = await prisma.emailVerificationToken.findUnique({ where: { accessRequestId: row!.id } });
    expect(rotated?.tokenHash).toBe(hashAccessToken(replacementToken));
    expect(rotated?.tokenHash).not.toBe(originalHash);
    expect((await postConfirmation(originalToken).expect(400)).body)
      .toEqual({ error: "INVALID_VERIFICATION_TOKEN" });
    expect((await postConfirmation(replacementToken).expect(200)).body)
      .toEqual({ message: "E-mail confirmado." });
  });

  it("preserva resposta neutra quando o SMTP falha e permite recuperação após cooldown", async () => {
    const failingSender = new FakeEmailSender({ fail: true });
    configureApp({ emailSender: failingSender });
    const failedDelivery = await postRequest().expect(202);
    expect(failedDelivery.body).toEqual(NEUTRAL_RESPONSE);
    const row = await activeRequest("nova-pessoa@empresa.local");
    const failedSlot = await prisma.emailVerificationToken.findUnique({
      where: { accessRequestId: row!.id },
    });
    expect(failedSlot?.revokedAt).toEqual(now);
    expect((await prisma.accessRequestEvent.findMany({ where: { accessRequestId: row!.id } }))
      .map((event) => event.eventType)).toContain("VERIFICATION_DELIVERY_FAILED");

    now = new Date(now.getTime() + COOLDOWN_MS + 1);
    sender = new FakeEmailSender();
    configureApp();
    const recovered = await postResend("NOVA-PESSOA@EMPRESA.LOCAL").expect(202);
    expect(recovered.body).toEqual(failedDelivery.body);
    expect(sender.messages).toHaveLength(1);
    const recoveredToken = emailTokenFromMessage(sender.messages[0]);
    const recoveredSlot = await prisma.emailVerificationToken.findUnique({
      where: { accessRequestId: row!.id },
    });
    expect(recoveredSlot?.tokenHash).toBe(hashAccessToken(recoveredToken));
    expect(recoveredSlot?.revokedAt).toBeNull();
  });

  it("responde com o mesmo erro para token malformado e canônico desconhecido", async () => {
    const malformed = await postConfirmation("not-a-token").expect(400);
    const unknown = await postConfirmation(Buffer.alloc(32, 7).toString("base64url")).expect(400);
    expect(malformed.body).toEqual({ error: "INVALID_VERIFICATION_TOKEN" });
    expect(unknown.body).toEqual(malformed.body);
    expect(malformed.body).not.toHaveProperty("token");
    expect(await prisma.user.count()).toBe(0);
  });

  it("não confirma token vencido e encerra reserva quando o próprio pedido venceu", async () => {
    await postRequest().expect(202);
    const row = await activeRequest("nova-pessoa@empresa.local");
    const token = emailTokenFromMessage(sender.messages[0]);
    now = new Date(now.getTime() + HOUR_MS + 1);
    const expiredToken = await postConfirmation(token).expect(400);
    expect(expiredToken.body).toEqual({ error: "INVALID_VERIFICATION_TOKEN" });
    expect(await prisma.accessRequest.findUnique({ where: { id: row!.id } }))
      .toMatchObject({ status: "PENDING_EMAIL_VERIFICATION", emailVerifiedAt: null });

    now = new Date(INITIAL_TIME.getTime() + 7 * DAY_MS + 1);
    const expiredRequestToken = await postConfirmation(token).expect(400);
    expect(expiredRequestToken.body).toEqual(expiredToken.body);
    expect(await prisma.accessRequest.findUnique({ where: { id: row!.id } }))
      .toMatchObject({ status: "EXPIRED", activeEmail: null });
  });

  it("confirma por HTTP sem CAPTCHA e rejeita replay sem criar User, Company ou Subscription", async () => {
    await postRequest().expect(202);
    const row = await activeRequest("nova-pessoa@empresa.local");
    const token = emailTokenFromMessage(sender.messages[0]);

    const confirmed = await postConfirmation(token).expect(200);
    const replay = await postConfirmation(token).expect(400);
    expect(confirmed.body).toEqual({ message: "E-mail confirmado." });
    expect(confirmed.body).not.toHaveProperty("accessToken");
    expect(confirmed.body).not.toHaveProperty("refreshToken");
    expect(confirmed.headers["set-cookie"]).toBeUndefined();
    expect(replay.body).toEqual({ error: "INVALID_VERIFICATION_TOKEN" });
    expect(await prisma.accessRequest.findUnique({ where: { id: row!.id } }))
      .toMatchObject({ status: "PENDING_REVIEW", emailVerifiedAt: now, activeEmail: "nova-pessoa@empresa.local" });

    const login = await request(app).post("/api/auth/login")
      .send({ email: "nova-pessoa@empresa.local", password: "Invented-access-test-password" })
      .expect(401);
    expect(login.body.code).toBe("INVALID_CREDENTIALS");
    const me = await request(app).get("/api/users/me").expect(401);
    expect(me.body.code).toBe("UNAUTHORIZED");
    expect(await Promise.all([
      prisma.user.count(),
      prisma.company.count(),
      prisma.subscription.count(),
      prisma.refreshToken.count(),
    ])).toEqual([0, 0, 0, 0]);
  });

  it("consome uma confirmação concorrente uma única vez", async () => {
    await postRequest().expect(202);
    const row = await activeRequest("nova-pessoa@empresa.local");
    const token = emailTokenFromMessage(sender.messages[0]);

    const results = await Promise.all([
      postConfirmation(token),
      postConfirmation(token),
      postConfirmation(token),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 400, 400]);
    expect(results.find((result) => result.status === 200)?.body)
      .toEqual({ message: "E-mail confirmado." });
    expect(results.filter((result) => result.status === 400).map((result) => result.body))
      .toEqual([
        { error: "INVALID_VERIFICATION_TOKEN" },
        { error: "INVALID_VERIFICATION_TOKEN" },
      ]);
    expect(await prisma.accessRequest.findUnique({ where: { id: row!.id } }))
      .toMatchObject({ status: "PENDING_REVIEW", emailVerifiedAt: now });
    expect(await prisma.user.count()).toBe(0);
  });

  it("ignora X-Forwarded-For quando trust proxy é zero", async () => {
    const captchaSpy = jest.spyOn(captcha, "verify");
    const limited = makePublicLimiter({ requestIp: { burst: 1, ratePerSecond: 1 } });
    publicLimiter.dispose();
    publicLimiter = limited.limiter;
    configureApp({ trustProxyHops: 0 });

    await postRequestFrom("first-ip@empresa.local", "198.51.100.10").expect(202);
    const response = await postRequestFrom("second-ip@empresa.local", "203.0.113.99").expect(429);
    expect(response.body.code).toBe("RATE_LIMITED");
    expect(response.headers["retry-after"]).toBeDefined();
    expect(captchaSpy).toHaveBeenCalledTimes(1);
    expect(await prisma.accessRequest.count()).toBe(1);
  });

  it("compartilha a quota de e-mail entre request e resend mesmo com IPs distintos confiados", async () => {
    const limited = makePublicLimiter({ email: { burst: 2, ratePerSecond: 0.01 } });
    publicLimiter.dispose();
    publicLimiter = limited.limiter;
    configureApp({ trustProxyHops: 1 });

    await postRequestFrom("shared-limit@empresa.local", "198.51.100.10").expect(202);
    now = new Date(now.getTime() + 1_001);
    await postResend("SHARED-LIMIT@EMPRESA.LOCAL", "203.0.113.20").expect(202);
    const limitedByEmail = await postRequestFrom("shared-limit@empresa.local", "192.0.2.35")
      .expect(429);
    expect(limitedByEmail.body.code).toBe("RATE_LIMITED");
    expect(await prisma.accessRequest.count()).toBe(1);
  });

  it("mantém a chave esgotada até o refill completo mesmo com TTL de armazenamento menor", async () => {
    const slowPolicy = { burst: 1, ratePerSecond: 0.1 };
    const limited = makePublicLimiter({ email: slowPolicy }, 1_000);
    publicLimiter.dispose();
    publicLimiter = limited.limiter;
    configureApp();
    expect(publicLimiter.effectiveStoreTtlMs).toBe(10_000);

    await postResend("quota-window@empresa.local").expect(202);
    await postResend("quota-window@empresa.local").expect(429);
    now = new Date(now.getTime() + 1_001);
    await postResend("quota-window@empresa.local").expect(429);
    now = new Date(now.getTime() + 8_999);
    await postResend("quota-window@empresa.local").expect(202);
    expect(await prisma.accessRequest.count()).toBe(0);
  });
});
