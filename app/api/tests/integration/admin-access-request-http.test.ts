/**
 * Valida a fila administrativa de solicitações pelo app Express real.
 * Existe para proteger o contrato HTTP, o RBAC persistido e a serialização segura;
 * consome os serviços e repositórios reais com e-mail simulado.
 */

import request from "supertest";
import { createApp } from "../../src/app";
import { createRateLimitConfig } from "../../src/config/rate-limit.config";
import type { AdminAccessRequestRouteDependencies } from "../../src/factories/admin-access-request.factory";
import { makeRateLimitService } from "../../src/factories/rate-limit.factory";
import { AccessRequestEntity, type AccessRequest, type AccessRequestStatus } from "../../src/models/access-request.model";
import type { AccessRequestAdminActor } from "../../src/models/admin-access-request.model";
import type { EmailMessage } from "../../src/models/email.model";
import { AccessRequestRepository } from "../../src/repositories/access-request.repository";
import { AdminAccessRequestQueryRepository } from "../../src/repositories/admin-access-request.repository";
import { UserRepository } from "../../src/repositories/user.repository";
import { AccessInvitationService } from "../../src/services/access-invitation.service";
import { AccessRequestAdminAuthorizationService } from "../../src/services/access-request-admin-authorization.service";
import { AdminAccessRequestDecisionService } from "../../src/services/admin-access-request-decision.service";
import { AdminAccessRequestQueryService } from "../../src/services/admin-access-request-query.service";
import { prisma } from "../../src/database/prisma.database";
import { FakeEmailSender } from "../fixtures/fake-email-sender";
import { seedUser } from "../fixtures/users.fixture";
import { cleanDatabase } from "../setup";
import { hashAccessToken } from "../../src/utils/access-token.util";
import { signAccessToken } from "../../src/utils/jwt.util";

const PUBLIC_WEB_URL = "https://app.vulnera.example";
const INITIAL_TIME = new Date("2026-10-23T12:00:00.000Z");
const INVITATION_COOLDOWN_MS = 60_000;
const PASSWORD = "Admin-access-http-test-password";
const REQUEST_INPUT = {
  name: "Pessoa solicitante",
  email: "solicitante@empresa.local",
  companyName: "Empresa declarada",
  phone: "+55 11 99999-0000",
};

let now: Date;
let sequence: number;
let sender: FakeEmailSender;
let app: ReturnType<typeof createApp>;
let globalRateLimit: ReturnType<typeof makeRateLimitService> | undefined;
let dependencies: AdminAccessRequestRouteDependencies;
let authorization: AccessRequestAdminAuthorizationService;
let requests: AccessRequestRepository;
let queryService: AdminAccessRequestQueryService;
let decisionService: AdminAccessRequestDecisionService;
let invitationService: AccessInvitationService;

function configureApp(options: { emailSender?: FakeEmailSender; injectAdminDependencies?: boolean } = {}): void {
  globalRateLimit?.dispose();
  globalRateLimit = makeRateLimitService(createRateLimitConfig({ enabled: false, trustProxyHops: 0 }));

  requests = new AccessRequestRepository(prisma);
  authorization = new AccessRequestAdminAuthorizationService(new UserRepository(prisma));
  queryService = new AdminAccessRequestQueryService(
    new AdminAccessRequestQueryRepository(prisma),
    authorization,
  );
  invitationService = new AccessInvitationService(
    requests,
    options.emailSender ?? sender,
    PUBLIC_WEB_URL,
    authorization,
    { clock: () => new Date(now), cooldownMs: INVITATION_COOLDOWN_MS },
  );
  decisionService = new AdminAccessRequestDecisionService(
    requests,
    invitationService,
    authorization,
    () => new Date(now),
  );
  dependencies = { queryService, decisionService, invitationService, authorization };

  app = createApp({
    rateLimitService: globalRateLimit,
    ...(options.injectAdminDependencies === false ? {} : { adminAccessRequestDependencies: dependencies }),
  });
}

async function seedAdmin(email = "admin@empresa.local") {
  const user = await seedUser({ name: "Admin de revisão", email, password: PASSWORD, role: "ADMIN" });
  return { user, token: signAccessToken({ userId: user.id, role: "ADMIN" }) };
}

async function seedRole(role: "CLIENT" | "PENTESTER", email: string) {
  const user = await seedUser({ name: role, email, password: PASSWORD, role });
  return { user, token: signAccessToken({ userId: user.id, role }) };
}

function authorized<T extends { set(name: string, value: string): T }>(call: T, token: string): T {
  return call.set("Authorization", `Bearer ${token}`);
}

async function createRequest(email?: string, createdAt = now): Promise<AccessRequest> {
  sequence += 1;
  const row = await requests.createIfEmailAvailable({
    ...REQUEST_INPUT,
    email: email ?? `solicitante-${sequence}@empresa.local`,
  }, createdAt);
  if (!row) throw new Error("FIXTURE_ACCESS_REQUEST_NOT_CREATED");
  return row;
}

async function transitionRequest(
  row: AccessRequest,
  toStatus: AccessRequestStatus,
  occurredAt: Date,
  actor?: AccessRequestAdminActor,
  reason?: string,
): Promise<AccessRequest> {
  const transition = new AccessRequestEntity(row).transitionTo(toStatus, actor, reason, occurredAt);
  if (!await requests.transitionIfCurrent(row.id, transition)) {
    throw new Error("FIXTURE_ACCESS_REQUEST_TRANSITION_FAILED");
  }
  const updated = await requests.findById(row.id);
  if (!updated) throw new Error("FIXTURE_ACCESS_REQUEST_DISAPPEARED");
  return updated;
}

async function createPendingReview(email?: string): Promise<AccessRequest> {
  const row = await createRequest(email);
  return transitionRequest(row, "PENDING_REVIEW", now);
}

async function createInStatus(status: AccessRequestStatus, index: number, actor: AccessRequestAdminActor): Promise<AccessRequest> {
  const creationTime = status === "EXPIRED" ? new Date(now.getTime() - 8 * 86_400_000) : now;
  let row = await createRequest(`status-${index}@empresa.local`, creationTime);
  if (status === "PENDING_EMAIL_VERIFICATION") return row;
  if (status === "EXPIRED") return transitionRequest(row, "EXPIRED", now);
  row = await transitionRequest(row, "PENDING_REVIEW", now);
  if (status === "PENDING_REVIEW") return row;
  if (status === "REJECTED") return transitionRequest(row, "REJECTED", now, actor, "Motivo de fixture");
  row = await transitionRequest(row, "APPROVED", now, actor);
  if (status === "APPROVED") return row;
  return transitionRequest(row, "ACTIVATED", now);
}

function inviteTokenFrom(message: Pick<EmailMessage, "text">): string {
  const match = message.text.match(/#token=([A-Za-z0-9_-]{43})/u);
  expect(match).not.toBeNull();
  return match![1];
}

function expectNoCredentialsOrSecrets(value: unknown): void {
  const serialized = JSON.stringify(value);
  expect(serialized).not.toContain("accessToken");
  expect(serialized).not.toContain("refreshToken");
  expect(serialized).not.toContain("tokenHash");
  expect(serialized).not.toContain('"token"');
}

function expectNoSession(response: { body: unknown; headers: { "set-cookie"?: unknown } }): void {
  expectNoCredentialsOrSecrets(response.body);
  expect(response.headers["set-cookie"]).toBeUndefined();
}

beforeEach(async () => {
  await cleanDatabase();
  now = new Date(INITIAL_TIME);
  sequence = 0;
  sender = new FakeEmailSender();
  configureApp();
});

afterEach(() => {
  globalRateLimit?.dispose();
  globalRateLimit = undefined;
});

describe("HTTP administrativo de AccessRequest", () => {
  it("exige sessão e role ADMIN, e revalida a conta persistida antes de consultar", async () => {
    const admin = await seedAdmin();
    const client = await seedRole("CLIENT", "client@empresa.local");
    const pentester = await seedRole("PENTESTER", "pentester@empresa.local");
    const row = await createPendingReview();
    const listSpy = jest.spyOn(queryService, "list");
    const approveSpy = jest.spyOn(decisionService, "approve");

    await request(app).get("/api/admin/access-requests")
      .expect(401)
      .expect(({ body }) => expect(body.code).toBe("UNAUTHORIZED"));
    await request(app).get("/api/admin/access-requests")
      .set("Authorization", "Bearer invalid")
      .expect(401)
      .expect(({ body }) => expect(body.code).toBe("INVALID_TOKEN"));
    await authorized(request(app).get("/api/admin/access-requests"), client.token)
      .expect(403)
      .expect(({ body }) => expect(body).toEqual({ error: "FORBIDDEN" }));
    await authorized(request(app).get("/api/admin/access-requests"), pentester.token)
      .expect(403)
      .expect(({ body }) => expect(body).toEqual({ error: "FORBIDDEN" }));
    await authorized(request(app).post(`/api/admin/access-requests/${row.id}/approve`), client.token)
      .expect(403)
      .expect(({ body }) => expect(body).toEqual({ error: "FORBIDDEN" }));
    await authorized(request(app).post(`/api/admin/access-requests/${row.id}/approve`), pentester.token)
      .expect(403)
      .expect(({ body }) => expect(body).toEqual({ error: "FORBIDDEN" }));

    await prisma.user.update({ where: { id: admin.user.id }, data: { role: "CLIENT" } });
    await authorized(request(app).get("/api/admin/access-requests"), admin.token)
      .expect(403)
      .expect(({ body }) => expect(body).toEqual({ code: "FORBIDDEN" }));
    expect(listSpy).not.toHaveBeenCalled();
    expect(approveSpy).not.toHaveBeenCalled();

    const removedAdmin = await seedAdmin("removed-admin@empresa.local");
    await prisma.user.delete({ where: { id: removedAdmin.user.id } });
    await authorized(request(app).get("/api/admin/access-requests"), removedAdmin.token)
      .expect(403)
      .expect(({ body }) => expect(body).toEqual({ code: "FORBIDDEN" }));
    expect(listSpy).not.toHaveBeenCalled();
    expect(approveSpy).not.toHaveBeenCalled();
    listSpy.mockRestore();
    approveSpy.mockRestore();
  });

  it("lista por padrão somente PENDING_REVIEW, aceita os seis estados e pagina no HTTP", async () => {
    const admin = await seedAdmin();
    const actor: AccessRequestAdminActor = { userId: admin.user.id, role: "ADMIN" };
    const statuses: AccessRequestStatus[] = [
      "PENDING_EMAIL_VERIFICATION", "PENDING_REVIEW", "APPROVED", "REJECTED", "EXPIRED", "ACTIVATED",
    ];
    const fixtures = new Map<AccessRequestStatus, AccessRequest>();
    for (const [index, status] of statuses.entries()) {
      fixtures.set(status, await createInStatus(status, index + 1, actor));
    }

    const defaultPage = await authorized(request(app).get("/api/admin/access-requests"), admin.token)
      .expect(200);
    expect(defaultPage.body).toMatchObject({ total: 1, page: 1, pageSize: 20 });
    expect(defaultPage.body.items.map((item: { status: string }) => item.status)).toEqual(["PENDING_REVIEW"]);

    for (const status of statuses) {
      const page = await authorized(request(app).get("/api/admin/access-requests").query({ status }), admin.token)
        .expect(200);
      expect(page.body).toMatchObject({ total: 1, page: 1, pageSize: 20 });
      expect(page.body.items[0]).toMatchObject({ id: fixtures.get(status)!.id, status });
      expectNoSession(page);
    }

    await createPendingReview("page-two@empresa.local");
    const firstPage = await authorized(request(app).get("/api/admin/access-requests")
      .query({ page: 1, pageSize: 1 }), admin.token).expect(200);
    const secondPage = await authorized(request(app).get("/api/admin/access-requests")
      .query({ page: 2, pageSize: 1 }), admin.token).expect(200);
    expect(firstPage.body).toMatchObject({ total: 2, page: 1, pageSize: 1 });
    expect(secondPage.body).toMatchObject({ total: 2, page: 2, pageSize: 1 });
    expect(firstPage.body.items).toHaveLength(1);
    expect(secondPage.body.items).toHaveLength(1);
    expect(firstPage.body.items[0].id).not.toBe(secondPage.body.items[0].id);
  });

  it("valida query, paginação, IDs e corpos de rejeição antes de chamar serviços", async () => {
    const admin = await seedAdmin();
    const row = await createPendingReview();
    const listSpy = jest.spyOn(queryService, "list");
    const rejectSpy = jest.spyOn(decisionService, "reject");

    const badQueries: Array<[Record<string, string>, string]> = [
      [{ page: "0" }, "INVALID_PAGE"],
      [{ page: "1.5" }, "INVALID_PAGE"],
      [{ page: "9007199254740992" }, "INVALID_PAGE"],
      [{ pageSize: "101" }, "INVALID_PAGE_SIZE"],
      [{ status: "pending_review" }, "INVALID_STATUS"],
    ];
    for (const [query, error] of badQueries) {
      const response = await authorized(request(app).get("/api/admin/access-requests").query(query), admin.token)
        .expect(400);
      expect(response.body).toEqual({ error });
    }

    await authorized(request(app).get("/api/admin/access-requests")
      .query({ page: "2147483649", pageSize: "2" }), admin.token)
      .expect(400, { error: "INVALID_PAGE" });
    await authorized(request(app).get("/api/admin/access-requests")
      .query("status=PENDING_REVIEW&status=APPROVED"), admin.token)
      .expect(400, { error: "INVALID_STATUS" });
    await authorized(request(app).get("/api/admin/access-requests/x"), admin.token)
      .expect(400, { error: "INVALID_ID" });
    await authorized(request(app).get("/api/admin/access-requests/cuid-not-found-000000"), admin.token)
      .expect(404, { error: "ACCESS_REQUEST_NOT_FOUND" });
    await authorized(request(app).get("/api/admin/access-requests/cuid-not-found-000000/events"), admin.token)
      .expect(404, { error: "ACCESS_REQUEST_NOT_FOUND" });
    await authorized(request(app).get(`/api/admin/access-requests/${row.id}/events`)
      .query({ page: "2147483649", pageSize: "2" }), admin.token)
      .expect(400, { error: "INVALID_PAGE" });

    const invalidBodies: Array<object> = [[], { reason: 7 }, { reason: "x".repeat(2_001) }];
    for (const body of invalidBodies) {
      const call = authorized(request(app).post(`/api/admin/access-requests/${row.id}/reject`), admin.token);
      await call.send(body).expect(400, { error: "INVALID_REASON" });
    }
    for (const primitiveBody of ["null", JSON.stringify("reason")]) {
      const response = await authorized(
        request(app).post(`/api/admin/access-requests/${row.id}/reject`),
        admin.token,
      ).set("Content-Type", "application/json").send(primitiveBody).expect(400);
      expectNoCredentialsOrSecrets(response.body);
    }
    expect(listSpy).not.toHaveBeenCalled();
    expect(rejectSpy).not.toHaveBeenCalled();
    expect(await requests.findById(row.id)).toMatchObject({ status: "PENDING_REVIEW" });
    listSpy.mockRestore();
    rejectSpy.mockRestore();
  });

  it("aprova via HTTP, devolve apenas DTO seguro e registra auditoria sem criar identidade", async () => {
    const admin = await seedAdmin();
    const row = await createPendingReview();
    const before = {
      users: await prisma.user.count(),
      companies: await prisma.company.count(),
      subscriptions: await prisma.subscription.count(),
      refreshTokens: await prisma.refreshToken.count(),
    };

    const approved = await authorized(request(app).post(`/api/admin/access-requests/${row.id}/approve`), admin.token)
      .expect(200);
    expect(approved.body).toMatchObject({
      request: { id: row.id, status: "APPROVED", reviewedById: admin.user.id },
      invitationDelivery: "SENT",
    });
    expectNoSession(approved);
    expect(approved.headers["set-cookie"]).toBeUndefined();
    expect(sender.messages).toHaveLength(1);

    const token = inviteTokenFrom(sender.messages[0]);
    const invitation = await prisma.accessInvitation.findUnique({ where: { accessRequestId: row.id } });
    expect(invitation).toMatchObject({ tokenHash: hashAccessToken(token), usedAt: null, revokedAt: null });
    expect(invitation?.tokenHash).not.toBe(token);
    expect(await prisma.auditLog.findMany({ where: { entityId: row.id } })).toMatchObject([{
      actorId: admin.user.id,
      companyId: null,
      entityType: "AccessRequest",
      action: "ACCESS_INVITATION_ISSUED",
      diffJson: null,
    }]);
    expect(await Promise.all([
      prisma.user.count(),
      prisma.company.count(),
      prisma.subscription.count(),
      prisma.refreshToken.count(),
    ])).toEqual([before.users, before.companies, before.subscriptions, before.refreshTokens]);

    const detail = await authorized(request(app).get(`/api/admin/access-requests/${row.id}`), admin.token).expect(200);
    expect(detail.body).toMatchObject({
      id: row.id,
      status: "APPROVED",
      invitation: { usedAt: null, revokedAt: null },
    });
    expectNoSession(detail);
    expect(JSON.stringify(detail.body)).not.toContain(token);

    const events = await authorized(request(app).get(`/api/admin/access-requests/${row.id}/events`)
      .query({ page: 1, pageSize: 10 }), admin.token).expect(200);
    expect(events.body).toMatchObject({ total: 3, page: 1, pageSize: 10 });
    expect(events.body.items.map((event: { toStatus: string }) => event.toStatus))
      .toEqual(["PENDING_EMAIL_VERIFICATION", "PENDING_REVIEW", "APPROVED"]);
    expectNoSession(events);
    expect(JSON.stringify(events.body)).not.toContain(token);
  });

  it("rejeita via HTTP com motivo normalizado e trata solicitação ausente ou em estado final", async () => {
    const admin = await seedAdmin();
    const row = await createPendingReview();
    const rejected = await authorized(request(app).post(`/api/admin/access-requests/${row.id}/reject`), admin.token)
      .send({ reason: "  domínio não permitido  " })
      .expect(200);
    expect(rejected.body.request).toMatchObject({
      id: row.id,
      status: "REJECTED",
      reviewedById: admin.user.id,
      rejectionReason: "domínio não permitido",
    });
    expectNoSession(rejected);
    expect(sender.messages).toHaveLength(0);
    expect(await requests.findActiveByEmail(row.email)).toBeNull();

    const nullableReason = await createPendingReview("nullable-reason@empresa.local");
    const noReason = await authorized(
      request(app).post(`/api/admin/access-requests/${nullableReason.id}/reject`),
      admin.token,
    ).send({ reason: null }).expect(200);
    expect(noReason.body.request).toMatchObject({ status: "REJECTED", rejectionReason: null });

    const omittedReason = await createPendingReview("omitted-reason@empresa.local");
    const omitted = await authorized(
      request(app).post(`/api/admin/access-requests/${omittedReason.id}/reject`),
      admin.token,
    ).expect(200);
    expect(omitted.body.request).toMatchObject({ status: "REJECTED", rejectionReason: null });

    await authorized(request(app).post("/api/admin/access-requests/cuid-not-found-000000/approve"), admin.token)
      .expect(404, { error: "ACCESS_REQUEST_NOT_FOUND" });
    await authorized(request(app).post(`/api/admin/access-requests/${row.id}/reject`), admin.token)
      .expect(422, { error: "INVALID_STATUS_TRANSITION" });
    await authorized(request(app).post(`/api/admin/access-requests/${row.id}/resend-invitation`), admin.token)
      .expect(422, { error: "INVALID_STATUS_TRANSITION" });
  });

  it("bloqueia colisão com User, expiração e reenvio durante cooldown pelo contrato HTTP", async () => {
    const admin = await seedAdmin();
    const collision = await createPendingReview("existing-account@empresa.local");
    await seedUser({
      name: "Conta já existente",
      email: "EXISTING-ACCOUNT@EMPRESA.LOCAL",
      password: PASSWORD,
      role: "CLIENT",
    });
    await authorized(request(app).post(`/api/admin/access-requests/${collision.id}/approve`), admin.token)
      .expect(409, { error: "USER_ALREADY_EXISTS" });
    expect(await requests.findById(collision.id)).toMatchObject({ status: "PENDING_REVIEW" });
    expect(await prisma.accessInvitation.count()).toBe(0);

    const expired = await createPendingReview("expired-review@empresa.local");
    now = new Date(expired.expiresAt.getTime() + 1);
    await authorized(request(app).post(`/api/admin/access-requests/${expired.id}/approve`), admin.token)
      .expect(422, { error: "ACCESS_REQUEST_EXPIRED" });
    expect(await requests.findById(expired.id)).toMatchObject({ status: "EXPIRED", activeEmail: null });

    now = new Date(INITIAL_TIME);
    const resendTarget = await createPendingReview("resend-target@empresa.local");
    await authorized(request(app).post(`/api/admin/access-requests/${resendTarget.id}/approve`), admin.token).expect(200);
    const firstHash = (await prisma.accessInvitation.findUnique({
      where: { accessRequestId: resendTarget.id },
    }))!.tokenHash;
    const cooldown = await authorized(
      request(app).post(`/api/admin/access-requests/${resendTarget.id}/resend-invitation`),
      admin.token,
    ).expect(429);
    expect(cooldown.body).toEqual({ error: "ACCESS_INVITATION_COOLDOWN" });
    expect(Number(cooldown.headers["retry-after"])).toBeGreaterThan(0);
    expect(sender.messages).toHaveLength(1);

    now = new Date(now.getTime() + INVITATION_COOLDOWN_MS + 1);
    const resent = await authorized(
      request(app).post(`/api/admin/access-requests/${resendTarget.id}/resend-invitation`),
      admin.token,
    ).expect(200);
    expect(resent.body).toMatchObject({
      request: { id: resendTarget.id, status: "APPROVED" },
      invitationDelivery: "SENT",
    });
    expectNoSession(resent);
    expect(sender.messages).toHaveLength(2);
    const replacementToken = inviteTokenFrom(sender.messages[1]);
    const rotated = await prisma.accessInvitation.findUnique({ where: { accessRequestId: resendTarget.id } });
    expect(rotated).toMatchObject({ tokenHash: hashAccessToken(replacementToken), revokedAt: null, usedAt: null });
    expect(rotated?.tokenHash).not.toBe(firstHash);
    expect(JSON.stringify(resent.body)).not.toContain(replacementToken);
  });

  it("mantém resposta HTTP genérica em falha SMTP, revoga convite e recupera no reenvio", async () => {
    let failedMessage: EmailMessage | undefined;
    const failingSender = new FakeEmailSender({
      fail: true,
      beforeSend: (message) => { failedMessage = message; },
    });
    configureApp({ emailSender: failingSender });
    const admin = await seedAdmin();
    const row = await createPendingReview();

    const failed = await authorized(request(app).post(`/api/admin/access-requests/${row.id}/approve`), admin.token)
      .expect(200);
    expect(failed.body).toMatchObject({
      request: { id: row.id, status: "APPROVED" },
      invitationDelivery: "DELIVERY_FAILED",
    });
    expectNoSession(failed);
    expect(failedMessage).toBeDefined();
    const failedToken = inviteTokenFrom(failedMessage!);
    const failedSlot = await prisma.accessInvitation.findUnique({ where: { accessRequestId: row.id } });
    expect(failedSlot).toMatchObject({ tokenHash: hashAccessToken(failedToken), revokedAt: now });
    expect(failingSender.messages).toHaveLength(0);

    now = new Date(now.getTime() + INVITATION_COOLDOWN_MS + 1);
    sender = new FakeEmailSender();
    configureApp();
    const recovered = await authorized(
      request(app).post(`/api/admin/access-requests/${row.id}/resend-invitation`),
      admin.token,
    ).expect(200);
    expect(recovered.body).toMatchObject({
      request: { id: row.id, status: "APPROVED" },
      invitationDelivery: "SENT",
    });
    expect(sender.messages).toHaveLength(1);
    const recoveredToken = inviteTokenFrom(sender.messages[0]);
    const slot = await prisma.accessInvitation.findUnique({ where: { accessRequestId: row.id } });
    expect(slot).toMatchObject({ tokenHash: hashAccessToken(recoveredToken), revokedAt: null });
    expect(slot?.tokenHash).not.toBe(hashAccessToken(failedToken));
    expect(await prisma.auditLog.findMany({ where: { entityId: row.id }, orderBy: { createdAt: "asc" } }))
      .toMatchObject([
        { action: "ACCESS_INVITATION_ISSUED", actorId: admin.user.id },
        { action: "ACCESS_INVITATION_DELIVERY_FAILED", actorId: admin.user.id },
        { action: "ACCESS_INVITATION_REISSUED", actorId: admin.user.id },
      ]);
  });

  it("serializa aprovação e rejeição concorrentes sem aplicar duas decisões", async () => {
    const firstAdmin = await seedAdmin("admin-a@empresa.local");
    const secondAdmin = await seedAdmin("admin-b@empresa.local");
    const row = await createPendingReview();

    const [approved, rejected] = await Promise.all([
      authorized(request(app).post(`/api/admin/access-requests/${row.id}/approve`), firstAdmin.token),
      authorized(request(app).post(`/api/admin/access-requests/${row.id}/reject`), secondAdmin.token)
        .send({ reason: "decisão concorrente" }),
    ]);
    expect([approved.status, rejected.status].sort()).toEqual([200, 422]);
    const final = await requests.findById(row.id);
    expect(["APPROVED", "REJECTED"]).toContain(final?.status);
    expect(await prisma.accessRequestEvent.count({ where: { accessRequestId: row.id } })).toBe(3);
    expect(await prisma.accessInvitation.count({ where: { accessRequestId: row.id } }))
      .toBe(final?.status === "APPROVED" ? 1 : 0);
    expect(sender.messages).toHaveLength(final?.status === "APPROVED" ? 1 : 0);
    expectNoSession(approved.status === 200 ? approved : rejected);
  });

  it("mantém consultas e rejeição disponíveis sem SMTP, e reverte aprovação se config SMTP faltar", async () => {
    const previousEnvironment = new Map<string, string | undefined>();
    const smtpKeys = ["SMTP_FROM", "SMTP_HOST", "PUBLIC_WEB_URL"];
    for (const key of smtpKeys) {
      previousEnvironment.set(key, process.env[key]);
      delete process.env[key];
    }

    try {
      configureApp({ injectAdminDependencies: false });
      const admin = await seedAdmin("lazy-admin@empresa.local");
      const rejectedFixture = await createPendingReview("lazy-reject@empresa.local");
      const approvalFixture = await createPendingReview("lazy-approve@empresa.local");

      const page = await authorized(request(app).get("/api/admin/access-requests"), admin.token).expect(200);
      expect(page.body.total).toBe(2);
      const rejected = await authorized(
        request(app).post(`/api/admin/access-requests/${rejectedFixture.id}/reject`),
        admin.token,
      ).send({ reason: "SMTP não é necessário para rejeitar" }).expect(200);
      expect(rejected.body.request).toMatchObject({ status: "REJECTED" });

      const before = await requests.findById(approvalFixture.id);
      const eventsBefore = await prisma.accessRequestEvent.count({ where: { accessRequestId: approvalFixture.id } });
      const failed = await authorized(
        request(app).post(`/api/admin/access-requests/${approvalFixture.id}/approve`),
        admin.token,
      ).expect(500);
      expect(failed.body).toEqual({ error: "INTERNAL_ERROR" });
      expectNoSession(failed);
      expect(await requests.findById(approvalFixture.id)).toEqual(before);
      expect(await prisma.accessRequestEvent.count({ where: { accessRequestId: approvalFixture.id } }))
        .toBe(eventsBefore);
      expect(await prisma.accessInvitation.count({ where: { accessRequestId: approvalFixture.id } })).toBe(0);
      expect(await prisma.auditLog.count({ where: { entityId: approvalFixture.id } })).toBe(0);
      expect(sender.messages).toHaveLength(0);
    } finally {
      for (const [key, value] of previousEnvironment) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });
});
