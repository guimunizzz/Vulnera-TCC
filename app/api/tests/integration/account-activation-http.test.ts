/**
 * Confirma o contrato HTTP público de validação e ativação de conta.
 * Verifica respostas neutras e login somente depois da ativação por convite.
 * Consumido pelo Jest de integração da Etapa 5 da Issue #51.
 */
import request from "supertest";
import { createApp } from "../../src/app";
import { createRateLimitConfig } from "../../src/config/rate-limit.config";
import type { AccountActivationRateLimitConfig } from "../../src/config/account-activation-rate-limit.config";
import type { AccountActivationRouteDependencies } from "../../src/factories/account-activation.factory";
import { makeRateLimitService } from "../../src/factories/rate-limit.factory";
import { AccessInvitationRepository } from "../../src/repositories/access-invitation.repository";
import { AccessRequestRepository } from "../../src/repositories/access-request.repository";
import { RefreshTokenRepository } from "../../src/repositories/refresh-token.repository";
import { AccountActivationRateLimitService } from "../../src/services/account-activation-rate-limit.service";
import { AccountActivationService } from "../../src/services/account-activation.service";
import { TokenBucketStore } from "../../src/utils/token-bucket.util";
import { generateAccessToken } from "../../src/utils/access-token.util";
import { prisma } from "../../src/database/prisma.database";
import { cleanDatabase } from "../setup";
import { createAccountActivationFixture } from "../fixtures/account-activation.fixture";

const INITIAL_TIME = new Date("2026-11-17T12:00:00.000Z");
const PASSWORD = "HTTP-activation-password-51";

let now: Date;
let globalRateLimit: ReturnType<typeof makeRateLimitService>;
let activationLimiter: AccountActivationRateLimitService;
let activationService: AccountActivationService;
let app: ReturnType<typeof createApp>;

function activationLimitConfig(overrides: {
  validateIp?: number;
  validateToken?: number;
  activateIp?: number;
  activateToken?: number;
  maxKeys?: number;
} = {}): AccountActivationRateLimitConfig {
  const policy = (burst: number) => ({ burst, ratePerSecond: burst / 60 });
  return {
    storeTtlMs: 60_000,
    storeMaxKeys: overrides.maxKeys ?? 1_000,
    policies: {
      validateIp: policy(overrides.validateIp ?? 100),
      validateToken: policy(overrides.validateToken ?? 100),
      activateIp: policy(overrides.activateIp ?? 100),
      activateToken: policy(overrides.activateToken ?? 100),
    },
  };
}

function configureApp(dependencies?: Pick<AccountActivationRouteDependencies, "service">): void {
  globalRateLimit?.dispose();
  activationLimiter?.dispose();
  globalRateLimit = makeRateLimitService(createRateLimitConfig({ enabled: false }));
  activationLimiter = new AccountActivationRateLimitService(
    activationLimitConfig(),
    new TokenBucketStore({ ttlMs: 60_000, maxKeys: 1_000, nowMs: () => now.getTime() }),
  );
  activationService = new AccountActivationService(
    new AccessRequestRepository(prisma),
    new AccessInvitationRepository(prisma),
    undefined,
    () => new Date(now),
  );
  app = createApp({
    rateLimitService: globalRateLimit,
    accountActivationDependencies: {
      service: dependencies?.service ?? activationService,
      limiter: activationLimiter,
    },
  });
}

beforeEach(async () => {
  await cleanDatabase();
  now = new Date(INITIAL_TIME);
  configureApp();
});

afterEach(() => {
  activationLimiter?.dispose();
  globalRateLimit?.dispose();
});

describe("HTTP público de ativação de conta", () => {
  it("valida convite real sem autenticação, dados pessoais ou credenciais", async () => {
    const fixture = await createAccountActivationFixture();

    const response = await request(app)
      .post("/api/account-activation/validate")
      .send({ token: fixture.token });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ valid: true });
    expect(response.headers["cache-control"]).toContain("no-store");
    expect(response.headers["set-cookie"]).toBeUndefined();
    expect(response.text).not.toContain(fixture.request.email);
    expect(response.text).not.toContain(fixture.request.name);
    expect(response.text).not.toContain(fixture.token);
    expect(response.headers.authorization).toBeUndefined();
  });

  it("responde valid=false de forma neutra quando o convite não existe", async () => {
    const response = await request(app)
      .post("/api/account-activation/validate")
      .send({ token: generateAccessToken().token });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ valid: false });
    expect(response.headers["cache-control"]).toContain("no-store");
  });

  it("ativa por convite sem abrir sessão e permite login, refresh e logout", async () => {
    const fixture = await createAccountActivationFixture({
      email: "activated-client@empresa.local",
      name: "Cliente ativado",
    });

    const activated = await request(app)
      .post("/api/account-activation/activate")
      .send({ token: fixture.token, password: PASSWORD });

    expect(activated.status).toBe(204);
    expect(activated.text ?? "").toBe("");
    expect(activated.headers["set-cookie"]).toBeUndefined();
    expect(await prisma.refreshToken.count()).toBe(0);
    expect(await prisma.user.findUnique({ where: { email: fixture.request.email } })).toMatchObject({
      name: fixture.request.name,
      role: "CLIENT",
      companyId: null,
    });

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: fixture.request.email, password: PASSWORD });
    expect(login.status).toBe(200);
    expect(login.body.accessToken).toEqual(expect.any(String));
    expect(login.body.refreshToken).toEqual(expect.any(String));
    expect(login.body.user).toMatchObject({
      name: fixture.request.name,
      email: fixture.request.email,
      role: "CLIENT",
      companyId: null,
    });
    expect(login.body.user.password).toBeUndefined();
    expect(login.headers["set-cookie"]).toBeUndefined();
    expect(await prisma.refreshToken.findUnique({
      where: { tokenHash: RefreshTokenRepository.hash(login.body.refreshToken) },
    })).not.toBeNull();

    const logout = await request(app)
      .post("/api/auth/logout")
      .send({ refreshToken: login.body.refreshToken });
    expect(logout.status).toBe(204);
    const refreshAfterLogout = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: login.body.refreshToken });
    expect(refreshAfterLogout.status).toBe(401);
    expect(refreshAfterLogout.body.code).toBe("INVALID_TOKEN");
  });

  it("login rejeita pedido sem aprovação/ativação e não abre sessão", async () => {
    const fixture = await createAccountActivationFixture({
      email: "pending-client@empresa.local",
      stage: "PENDING_REVIEW",
    });

    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: fixture.request.email, password: PASSWORD });

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ code: "INVALID_CREDENTIALS" });
    expect(await prisma.user.findUnique({ where: { email: fixture.request.email } })).toBeNull();
    expect(await prisma.refreshToken.count()).toBe(0);
    expect(await prisma.accessRequest.findUnique({ where: { id: fixture.request.id } })).toMatchObject({ status: "PENDING_REVIEW" });
  });

  it.each([
    ["campos adicionais", { token: generateAccessToken().token, password: PASSWORD, role: "ADMIN", companyId: "injected", companyRole: "OWNER" }, "INVALID_BODY"],
    ["senha curta", { token: generateAccessToken().token, password: "short" }, "WEAK_PASSWORD"],
    ["senha ausente", { token: generateAccessToken().token }, "INVALID_PASSWORD"],
    ["senha acima de 72 bytes UTF-8", { token: generateAccessToken().token, password: "á".repeat(37) }, "INVALID_PASSWORD"],
  ])("rejeita %s sem encaminhar a operação ao serviço", async (_label, body, error) => {
    const activate = jest.fn(async () => undefined);
    const validate = jest.fn(async () => ({ valid: false }));
    configureApp({ service: { activate, validate } });

    const response = await request(app).post("/api/account-activation/activate").send(body);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error });
    expect(activate).not.toHaveBeenCalled();
  });

  it("aceita o limite de 72 bytes UTF-8 sem normalizar a senha", async () => {
    const token = generateAccessToken().token;
    const password = "🔐".repeat(18);
    const activate = jest.fn(async () => undefined);
    const validate = jest.fn(async () => ({ valid: false }));
    configureApp({ service: { activate, validate } });

    const response = await request(app).post("/api/account-activation/activate").send({ token, password });

    expect(response.status).toBe(204);
    expect(activate).toHaveBeenCalledWith(token, password);
  });

  it("não aceita role, companyId, e-mail ou estado injetados por um body público", async () => {
    const fixture = await createAccountActivationFixture();
    const response = await request(app).post("/api/account-activation/activate").send({
      token: fixture.token,
      password: PASSWORD,
      role: "ADMIN",
      companyId: "company-injected",
      companyRole: "OWNER",
      email: "attacker@empresa.local",
      name: "Conta atacante",
      status: "APPROVED",
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "INVALID_BODY" });
    expect(await prisma.user.count({ where: { role: "CLIENT" } })).toBe(0);
    expect(await prisma.accessRequest.findUnique({ where: { id: fixture.request.id } })).toEqual(fixture.request);
    expect(await prisma.accessInvitation.findUnique({ where: { accessRequestId: fixture.request.id } })).toEqual(fixture.invitation);
  });
});
