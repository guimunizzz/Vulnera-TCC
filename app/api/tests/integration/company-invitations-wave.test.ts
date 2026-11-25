/**
 * Canários independentes do convite empresarial e de sua autorização por tenant.
 * Usa o app HTTP real com relógio, limiter e remetente controláveis.
 * Consumido pelo Jest de integração contra o schema MySQL descartável.
 */

import request from "supertest";
import { createApp } from "../../src/app";
import { makeRateLimitService } from "../../src/factories/rate-limit.factory";
import { loadRateLimitConfig } from "../../src/config/rate-limit.config";
import { prisma } from "../../src/database/prisma.database";
import { CompanyInvitationRepository } from "../../src/repositories/company-invitation.repository";
import { UserRepository } from "../../src/repositories/user.repository";
import { CompanyInvitationRateLimitService } from "../../src/services/company-invitation-rate-limit.service";
import { CompanyInvitationService } from "../../src/services/company-invitation.service";
import { generateAccessToken, hashAccessToken } from "../../src/utils/access-token.util";
import { FakeEmailSender } from "../fixtures/fake-email-sender";
import { loginAs } from "../fixtures/auth.fixture";
import {
  seedTenantSecurityWaveFixture,
  TENANT_SECURITY_WAVE_PASSWORD,
} from "../fixtures/tenant-security-wave.fixture";
import { cleanDatabase } from "../setup";

const PUBLIC_WEB_URL = "https://tenant-wave.example";
const MEMBER_PASSWORD = "new-team-member-password";
const RESEND_COOLDOWN_MS = 60_000;
const invitationTokenPattern = /#token=(team_[A-Za-z0-9_-]{43})/u;

type BarrierHasher = (password: string) => Promise<string>;

class PasswordHashBarrier {
  private calls = 0;
  private releaseWaiting!: () => void;
  private markArrivals!: () => void;
  private readonly arrivals = new Promise<void>((resolve) => { this.markArrivals = resolve; });
  private readonly released = new Promise<void>((resolve) => { this.releaseWaiting = resolve; });

  constructor(private readonly expectedCalls: number) {}

  hash: BarrierHasher = async (password) => {
    this.calls += 1;
    if (this.calls === this.expectedCalls) this.markArrivals();
    await this.released;
    return `barrier-hash:${password.length}`;
  };

  async waitForCallsOrEarlyResponse(
    requests: Array<Promise<{ status: number }>>,
    label: string,
    timeoutMs = 5_000,
  ): Promise<void> {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const earlyResponse = Promise.race(requests.map((request, index) => request.then((response) => {
      throw new Error(`${label}: HTTP ${response.status} antes de todos os hashes de senha chegarem à barreira (request ${index + 1})`);
    })));
    const deadline = new Promise<never>((_resolve, reject) => {
      timeout = setTimeout(() => reject(new Error(`${label}: timeout esperando ${this.expectedCalls} hash(es) de senha`)), timeoutMs);
    });

    try {
      await Promise.race([this.arrivals, earlyResponse, deadline]);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  release(): void {
    this.releaseWaiting();
  }
}

let now: Date;
let sender: FakeEmailSender;
let limiter: CompanyInvitationRateLimitService;
let limiters: CompanyInvitationRateLimitService[];
let globalLimiters: ReturnType<typeof makeRateLimitService>[];
let app: ReturnType<typeof createApp>;
let wave: Awaited<ReturnType<typeof seedTenantSecurityWaveFixture>>;

function makeInvitationApp(passwordHasher?: BarrierHasher) {
  limiter = new CompanyInvitationRateLimitService();
  limiters.push(limiter);
  const service = new CompanyInvitationService(
    new CompanyInvitationRepository(prisma),
    new UserRepository(prisma),
    limiter,
    () => ({ sender, publicWebUrl: PUBLIC_WEB_URL }),
    {
      clock: () => new Date(now),
      ...(passwordHasher ? { passwordHasher } : {}),
    },
  );
  const globalRateLimit = makeRateLimitService({ ...loadRateLimitConfig(), enabled: false });
  globalLimiters.push(globalRateLimit);
  return createApp({ rateLimitService: globalRateLimit, companyInvitationDependencies: { service, limiter } });
}

async function createInvitation(ownerToken: string, name: string, email: string) {
  return request(app)
    .post("/api/companies/me/invitations")
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({ name, email });
}

function tokenFromEmail(index = sender.messages.length - 1): string {
  const match = sender.messages[index]?.text.match(invitationTokenPattern);
  expect(match).not.toBeNull();
  return match![1];
}

async function activate(token: string) {
  return request(app)
    .post("/api/company-invitations/activate")
    .send({ token, password: MEMBER_PASSWORD });
}

beforeEach(async () => {
  await cleanDatabase();
  now = new Date();
  sender = new FakeEmailSender();
  limiters = [];
  globalLimiters = [];
  app = makeInvitationApp();
  wave = await seedTenantSecurityWaveFixture(now);
});

afterEach(() => {
  for (const currentLimiter of limiters) currentLimiter.dispose();
  for (const globalLimiter of globalLimiters) globalLimiter.dispose();
});

describe("canários independentes de convite empresarial", () => {
  it("deriva empresa e papel do OWNER, grava histórico e ativa um MEMBER sem emitir sessão", async () => {
    const [ownerAToken, ownerBToken, memberAToken, adminToken, legacyToken] = await Promise.all([
      loginAs(app, wave.ownerA.email, TENANT_SECURITY_WAVE_PASSWORD),
      loginAs(app, wave.ownerB.email, TENANT_SECURITY_WAVE_PASSWORD),
      loginAs(app, wave.memberA.email, TENANT_SECURITY_WAVE_PASSWORD),
      loginAs(app, wave.admin.email, TENANT_SECURITY_WAVE_PASSWORD),
      loginAs(app, wave.legacyClient.email, TENANT_SECURITY_WAVE_PASSWORD),
    ]);

    const anonymousList = await request(app).get("/api/companies/me/members");
    expect(anonymousList.status).toBe(401);

    const memberListDenied = await request(app)
      .get("/api/companies/me/members")
      .set("Authorization", `Bearer ${memberAToken}`);
    expect(memberListDenied.status).toBe(403);

    const memberCreate = await createInvitation(memberAToken, "Não autorizado", "denied@tenant-wave.local");
    expect(memberCreate.status).toBe(403);
    const adminCreate = await createInvitation(adminToken, "Acesso administrativo", "admin-invite@tenant-wave.local");
    expect(adminCreate.status).toBe(403);
    const legacyCreate = await createInvitation(legacyToken, "Conta sem empresa", "legacy-invite@tenant-wave.local");
    expect(legacyCreate.status).toBe(403);
    expect(await prisma.companyInvitation.count()).toBe(0);
    expect(await prisma.auditLog.count({ where: { entityType: "CompanyInvitation" } })).toBe(0);

    const userCountBeforeWrongPurpose = await prisma.user.count();
    const onboardingToken = generateAccessToken().token;
    const wrongPurposeValidation = await request(app)
      .post("/api/company-invitations/validate")
      .send({ token: onboardingToken });
    expect(wrongPurposeValidation.status).toBe(400);
    expect(wrongPurposeValidation.body.error).toBe("INVALID_COMPANY_INVITATION");
    expect((await activate(onboardingToken)).status).toBe(400);
    expect(await prisma.user.count()).toBe(userCountBeforeWrongPurpose);

    const ownerMembers = await request(app)
      .get("/api/companies/me/members")
      .set("Authorization", `Bearer ${ownerAToken}`);
    expect(ownerMembers.status).toBe(200);
    expect(ownerMembers.body.map((member: { id: string }) => member.id)).toEqual(expect.arrayContaining([
      wave.ownerA.id,
      wave.memberA.id,
    ]));
    expect(ownerMembers.body).toHaveLength(2);
    expect(ownerMembers.body.find((member: { id: string }) => member.id === wave.ownerA.id).companyRole).toBe("OWNER");
    expect(ownerMembers.body.find((member: { id: string }) => member.id === wave.memberA.id).companyRole).toBe("MEMBER");
    expect(JSON.stringify(ownerMembers.body)).not.toContain(wave.disabledMember.email);

    const tamperedBody = await request(app)
      .post("/api/companies/me/invitations")
      .set("Authorization", `Bearer ${ownerAToken}`)
      .send({ name: "Membro A", email: "member-new@tenant-wave.local", companyId: wave.companyB.id, role: "ADMIN" });
    expect(tamperedBody.status).toBe(400);
    expect(tamperedBody.body.error).toBe("INVALID_BODY");
    expect(await prisma.companyInvitation.count()).toBe(0);

    const invitationBResponse = await createInvitation(ownerBToken, "Membro B", "member-b-invite@tenant-wave.local");
    expect(invitationBResponse.status).toBe(201);
    const invitationB = await prisma.companyInvitation.findFirst({ where: { email: "member-b-invite@tenant-wave.local" } });
    const hashB = invitationB!.tokenHash;
    const companyBAuditCount = await prisma.auditLog.count({ where: { companyId: wave.companyB.id } });
    const totalAuditCountBeforeForeignManagement = await prisma.auditLog.count();

    const foreignRevoke = await request(app)
      .delete(`/api/companies/me/invitations/${invitationB!.id}`)
      .set("Authorization", `Bearer ${ownerAToken}`);
    expect(foreignRevoke.status).toBe(404);
    const foreignResend = await request(app)
      .post(`/api/companies/me/invitations/${invitationB!.id}/resend`)
      .set("Authorization", `Bearer ${ownerAToken}`);
    expect(foreignResend.status).toBe(404);
    expect(await prisma.companyInvitation.findUnique({ where: { id: invitationB!.id } }))
      .toMatchObject({ companyId: wave.companyB.id, tokenHash: hashB, activeEmail: "member-b-invite@tenant-wave.local", revokedAt: null, usedAt: null });
    expect(await prisma.auditLog.count({ where: { companyId: wave.companyB.id } })).toBe(companyBAuditCount);
    expect(await prisma.auditLog.count()).toBe(totalAuditCountBeforeForeignManagement);
    expect(await prisma.companyInvitation.count()).toBe(1);

    const issued = await createInvitation(ownerAToken, "Membro A", "Member-New@Tenant-Wave.local");
    expect(issued.status).toBe(201);
    expect(issued.body.delivery).toBe("SENT");
    expect(JSON.stringify(issued.body)).not.toMatch(/token|hash|companyId|issuerId/iu);
    const token = tokenFromEmail(1);
    const invitation = await prisma.companyInvitation.findFirst({ where: { email: "member-new@tenant-wave.local" } });
    expect(invitation).toMatchObject({
      companyId: wave.companyA.id,
      issuerId: wave.ownerA.id,
      email: "member-new@tenant-wave.local",
      activeEmail: "member-new@tenant-wave.local",
      tokenHash: hashAccessToken(token),
      usedAt: null,
      revokedAt: null,
      issuedAt: now,
      expiresAt: new Date(now.getTime() + 48 * 60 * 60 * 1_000),
    });
    expect(invitation!.tokenHash).not.toBe(token);
    expect(issued.body.invitation).not.toHaveProperty("tokenHash");

    const valid = await request(app).post("/api/company-invitations/validate").send({ token });
    expect(valid.status).toBe(200);
    expect(valid.body).toEqual({ valid: true });

    const accepted = await activate(token);
    expect(accepted.status).toBe(204);
    expect(accepted.headers["set-cookie"]).toBeUndefined();
    expect(JSON.stringify(accepted.body ?? {})).not.toMatch(/accessToken|refreshToken|jwt/iu);

    const createdMember = await prisma.user.findUnique({ where: { email: "member-new@tenant-wave.local" } });
    expect(createdMember).toMatchObject({
      role: "CLIENT",
      companyRole: "MEMBER",
      companyId: wave.companyA.id,
      legacyOnboardingAllowed: false,
    });
    expect(await prisma.user.count({ where: { email: "member-new@tenant-wave.local" } })).toBe(1);
    expect(await prisma.refreshToken.count({ where: { userId: createdMember!.id } })).toBe(0);

    const consumed = await prisma.companyInvitation.findUnique({ where: { id: invitation!.id } });
    expect(consumed).toMatchObject({ usedAt: now, activeEmail: null, revokedAt: null });
    const history = await prisma.auditLog.findMany({
      where: { entityType: "CompanyInvitation", entityId: invitation!.id, companyId: wave.companyA.id },
      orderBy: { createdAt: "asc" },
    });
    expect(history.map((event) => event.action)).toEqual(["ISSUED", "ACCEPTED"]);
    expect(history[1]).toMatchObject({ actorId: createdMember!.id, companyId: wave.companyA.id });

    const ownerHistory = await request(app)
      .get("/api/companies/me/invitations/history")
      .set("Authorization", `Bearer ${ownerAToken}`);
    expect(ownerHistory.status).toBe(200);
    expect(ownerHistory.body.map((event: { action: string }) => event.action).sort()).toEqual(["ACCEPTED", "ISSUED"]);
    expect(JSON.stringify(ownerHistory.body)).not.toMatch(/tokenHash|accessToken|refreshToken/iu);
    expect(JSON.stringify(ownerHistory.body)).not.toContain(token);

    const otherTenantHistory = await request(app)
      .get("/api/companies/me/invitations/history")
      .set("Authorization", `Bearer ${ownerBToken}`);
    expect(otherTenantHistory.status).toBe(200);
    expect(otherTenantHistory.body.map((event: { invitationId: string }) => event.invitationId)).toContain(invitationB!.id);
    expect(otherTenantHistory.body.map((event: { invitationId: string }) => event.invitationId)).not.toContain(invitation!.id);

    const reused = await activate(token);
    expect(reused.status).toBe(400);
    expect(reused.body.error).toBe("INVALID_COMPANY_INVITATION");
    expect(await prisma.user.count({ where: { email: "member-new@tenant-wave.local" } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { entityType: "CompanyInvitation", entityId: invitation!.id, action: "ACCEPTED" } })).toBe(1);
  });

  it("serializa duas ativações do mesmo token em uma conta e um evento", async () => {
    const barrier = new PasswordHashBarrier(2);
    app = makeInvitationApp(barrier.hash);
    const ownerToken = await loginAs(app, wave.ownerA.email, TENANT_SECURITY_WAVE_PASSWORD);
    const issued = await createInvitation(ownerToken, "Ativação concorrente", "concurrent@tenant-wave.local");
    expect(issued.status).toBe(201);
    const token = tokenFromEmail();

    const activations = [activate(token), activate(token)];
    try {
      await barrier.waitForCallsOrEarlyResponse(activations, "ativação concorrente");
    } finally {
      barrier.release();
    }
    const results = await Promise.all(activations);

    expect(results.map((result) => result.status).sort()).toEqual([204, 400]);
    const member = await prisma.user.findUnique({ where: { email: "concurrent@tenant-wave.local" } });
    expect(member).toMatchObject({ role: "CLIENT", companyRole: "MEMBER", companyId: wave.companyA.id });
    expect(await prisma.user.count({ where: { email: "concurrent@tenant-wave.local" } })).toBe(1);
    expect(await prisma.refreshToken.count({ where: { userId: member!.id } })).toBe(0);
    expect(await prisma.auditLog.count({ where: { entityType: "CompanyInvitation", action: "ACCEPTED" } })).toBe(1);
  });

  it("faz revogação ganhar a corrida controlada com uma ativação já validada", async () => {
    const barrier = new PasswordHashBarrier(1);
    app = makeInvitationApp(barrier.hash);
    const ownerToken = await loginAs(app, wave.ownerA.email, TENANT_SECURITY_WAVE_PASSWORD);
    const issued = await createInvitation(ownerToken, "Revogação concorrente", "revoke-race@tenant-wave.local");
    expect(issued.status).toBe(201);
    const token = tokenFromEmail();
    const invitationId = issued.body.invitation.id as string;

    const activation = activate(token);
    try {
      await barrier.waitForCallsOrEarlyResponse([activation], "ativação concorrente com revogação");
      const revoked = await request(app)
        .delete(`/api/companies/me/invitations/${invitationId}`)
        .set("Authorization", `Bearer ${ownerToken}`);
      expect(revoked.status).toBe(204);
    } finally {
      barrier.release();
    }
    expect((await activation).status).toBe(400);

    expect(await prisma.user.count({ where: { email: "revoke-race@tenant-wave.local" } })).toBe(0);
    expect(await prisma.companyInvitation.findUnique({ where: { id: invitationId } }))
      .toMatchObject({ activeEmail: null, revokedAt: now, usedAt: null });
    const revocationEvents = await prisma.auditLog.findMany({
      where: { entityType: "CompanyInvitation", entityId: invitationId, companyId: wave.companyA.id },
      orderBy: { createdAt: "asc" },
      select: { action: true },
    });
    expect(revocationEvents.map((event) => event.action).sort()).toEqual(["ISSUED", "REVOKED"]);
  });

  it("rotaciona o token no reenvio concorrente, aplica cooldown e invalida a ativação antiga", async () => {
    const barrier = new PasswordHashBarrier(1);
    app = makeInvitationApp(barrier.hash);
    const ownerToken = await loginAs(app, wave.ownerA.email, TENANT_SECURITY_WAVE_PASSWORD);
    const issued = await createInvitation(ownerToken, "Reenvio concorrente", "resend-race@tenant-wave.local");
    expect(issued.status).toBe(201);
    const oldToken = tokenFromEmail();
    const invitationId = issued.body.invitation.id as string;
    const oldHash = hashAccessToken(oldToken);

    const tooSoon = await request(app)
      .post(`/api/companies/me/invitations/${invitationId}/resend`)
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(tooSoon.status).toBe(429);
    expect(Number(tooSoon.headers["retry-after"])).toBeGreaterThan(0);
    expect(sender.messages).toHaveLength(1);
    expect((await prisma.companyInvitation.findUnique({ where: { id: invitationId } }))?.tokenHash).toBe(oldHash);

    now = new Date(now.getTime() + RESEND_COOLDOWN_MS + 1);
    const activation = activate(oldToken);
    let newToken = "";
    try {
      await barrier.waitForCallsOrEarlyResponse([activation], "ativação concorrente com reenvio");
      const resent = await request(app)
        .post(`/api/companies/me/invitations/${invitationId}/resend`)
        .set("Authorization", `Bearer ${ownerToken}`);
      expect(resent.status).toBe(200);
      expect(resent.body.delivery).toBe("SENT");
      expect(sender.messages).toHaveLength(2);
      newToken = tokenFromEmail(1);
      expect(newToken).not.toBe(oldToken);
    } finally {
      barrier.release();
    }

    expect((await activation).status).toBe(400);
    expect(await prisma.user.count({ where: { email: "resend-race@tenant-wave.local" } })).toBe(0);
    expect(await request(app).post("/api/company-invitations/validate").send({ token: oldToken }))
      .toMatchObject({ status: 200, body: { valid: false } });
    expect(await request(app).post("/api/company-invitations/validate").send({ token: newToken }))
      .toMatchObject({ status: 200, body: { valid: true } });
    expect(await prisma.companyInvitation.findUnique({ where: { id: invitationId } }))
      .toMatchObject({ tokenHash: hashAccessToken(newToken), usedAt: null, revokedAt: null, activeEmail: "resend-race@tenant-wave.local" });
    const resendEvents = await prisma.auditLog.findMany({
      where: { entityType: "CompanyInvitation", entityId: invitationId, companyId: wave.companyA.id },
      orderBy: { createdAt: "asc" },
      select: { action: true },
    });
    expect(resendEvents.map((event) => event.action).sort()).toEqual(["ISSUED", "RESENT"]);
  });

  it("mantém limite público separado e exige autorização mesmo sem consumo do limiter global", async () => {
    const token = `team_${Buffer.alloc(32, 7).toString("base64url")}`;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await activate(token);
      expect(response.status).toBe(400);
      expect(response.body.error).toBe("INVALID_COMPANY_INVITATION");
    }
    const limited = await activate(token);
    expect(limited.status).toBe(429);
    expect(limited.body.error).toBe("RATE_LIMITED");
    expect(Number(limited.headers["retry-after"])).toBeGreaterThan(0);
    expect(await prisma.companyInvitation.count()).toBe(0);
    expect(await prisma.user.count()).toBe(8 + 1); // oito identidades ativas e o colaborador desativado

    const noAuth = await request(app).get("/api/companies/me/invitations");
    expect(noAuth.status).toBe(401);
    const memberToken = await loginAs(app, wave.memberA.email, TENANT_SECURITY_WAVE_PASSWORD);
    const memberDenied = await request(app)
      .get("/api/companies/me/invitations")
      .set("Authorization", `Bearer ${memberToken}`);
    expect(memberDenied.status).toBe(403);
    expect(memberDenied.body.error).toBe("FORBIDDEN");
  });
});
