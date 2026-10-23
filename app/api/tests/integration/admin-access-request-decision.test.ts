/**
 * Valida decisões administrativas com transações MySQL e entrega isolada.
 * Existe para provar que aprovação, convite e auditoria compartilham atomicidade;
 * consumido pelo Jest da API antes de qualquer criação de identidade.
 */
import { prisma } from "../../src/database/prisma.database";
import {
  AccessRequestEntity,
  type AccessRequest,
} from "../../src/models/access-request.model";
import type { AccessRequestAdminActor } from "../../src/models/admin-access-request.model";
import { AccessInvitationService } from "../../src/services/access-invitation.service";
import { AccessRequestAdminAuthorizationService } from "../../src/services/access-request-admin-authorization.service";
import { AdminAccessRequestDecisionService } from "../../src/services/admin-access-request-decision.service";
import type { EmailSender } from "../../src/models/email.model";
import { AccessRequestRepository } from "../../src/repositories/access-request.repository";
import { UserRepository } from "../../src/repositories/user.repository";
import { generateAccessToken } from "../../src/utils/access-token.util";
import { FakeEmailSender } from "../fixtures/fake-email-sender";
import { seedUser } from "../fixtures/users.fixture";
import { cleanDatabase } from "../setup";

const requests = new AccessRequestRepository(prisma);
const authorization = new AccessRequestAdminAuthorizationService(new UserRepository(prisma));
const PUBLIC_WEB_URL = "https://app.vulnera.example";
const PASSWORD = "Decision-test-password";
const INITIAL_TIME = new Date("2026-10-01T12:00:00.000Z");

let now: Date;
let sequence: number;

beforeEach(async () => {
  await cleanDatabase();
  now = new Date(INITIAL_TIME);
  sequence = 0;
});

function invitationService(sender: EmailSender = new FakeEmailSender()): AccessInvitationService {
  return new AccessInvitationService(requests, sender, PUBLIC_WEB_URL, authorization, {
    clock: () => new Date(now),
  });
}

function decisionService(
  sender: EmailSender = new FakeEmailSender(),
  invites: AccessInvitationService = invitationService(sender),
): AdminAccessRequestDecisionService {
  return new AdminAccessRequestDecisionService(requests, invites, authorization, () => new Date(now));
}

async function seedAdmin(email = "decision-admin@vulnera.local"): Promise<AccessRequestAdminActor> {
  const user = await seedUser({ name: "Admin de revisão", email, password: PASSWORD, role: "ADMIN" });
  return { userId: user.id, role: "ADMIN" };
}

async function createPendingReview(email?: string): Promise<AccessRequest> {
  sequence += 1;
  const request = await requests.createIfEmailAvailable({
    name: "Solicitante pendente",
    email: email ?? `decision-${sequence}@empresa.local`,
    companyName: "Empresa declarada",
    phone: "11999990000",
  }, now);
  expect(request).not.toBeNull();

  const verification = new AccessRequestEntity(request!).transitionTo(
    "PENDING_REVIEW",
    undefined,
    undefined,
    now,
  );
  expect(await requests.transitionIfCurrent(request!.id, verification)).toBe(true);
  return (await requests.findById(request!.id))!;
}

describe("AdminAccessRequestDecisionService — Issue #51 Etapa 4", () => {
  it("aprova, persiste slot/auditoria e só então envia; não cria identidade nem retorna segredo", async () => {
    const actor = await seedAdmin();
    const request = await createPendingReview();
    let committedAtSend: {
      request: AccessRequest | null;
      invitation: { tokenHash: string; revokedAt: Date | null } | null;
      audit: Array<{ actorId: string; companyId: string | null; action: string; diffJson: string | null }>;
    } | undefined;
    const sender = new FakeEmailSender({
      beforeSend: async () => {
        const [approved, slot, audit] = await Promise.all([
          requests.findById(request.id),
          prisma.accessInvitation.findUnique({ where: { accessRequestId: request.id } }),
          prisma.auditLog.findMany({ where: { entityId: request.id }, orderBy: { createdAt: "asc" } }),
        ]);
        committedAtSend = {
          request: approved,
          invitation: slot ? { tokenHash: slot.tokenHash, revokedAt: slot.revokedAt } : null,
          audit: audit.map(({ actorId, companyId, action, diffJson }) => ({ actorId, companyId, action, diffJson })),
        };
      },
    });
    const service = decisionService(sender);
    const countsBefore = {
      users: await prisma.user.count(),
      companies: await prisma.company.count(),
      subscriptions: await prisma.subscription.count(),
      refreshTokens: await prisma.refreshToken.count(),
    };

    const result = await service.approve(request.id, actor);

    expect(result).toMatchObject({ request: { id: request.id, status: "APPROVED", activeEmail: request.email }, invitationDelivery: "SENT" });
    expect(committedAtSend?.request).toMatchObject({ status: "APPROVED", reviewedById: actor.userId });
    expect(committedAtSend?.invitation).toMatchObject({ revokedAt: null });
    expect(committedAtSend?.audit).toEqual([{
      actorId: actor.userId,
      companyId: null,
      action: "ACCESS_INVITATION_ISSUED",
      diffJson: null,
    }]);
    expect(sender.messages).toHaveLength(1);
    expect("prepared" in result).toBe(false);
    expect("token" in result).toBe(false);
    expect(await Promise.all([
      prisma.user.count(), prisma.company.count(), prisma.subscription.count(), prisma.refreshToken.count(),
    ])).toEqual([countsBefore.users, countsBefore.companies, countsBefore.subscriptions, countsBefore.refreshTokens]);
  });

  it("rejeita com ator e motivo, libera reserva e revoga slots ainda utilizáveis", async () => {
    const actor = await seedAdmin();
    const request = await createPendingReview();
    const verificationSecret = generateAccessToken();
    await prisma.emailVerificationToken.create({
      data: {
        accessRequestId: request.id,
        tokenHash: verificationSecret.tokenHash,
        expiresAt: new Date(now.getTime() + 60 * 60_000),
        createdAt: now,
        issuedAt: now,
      },
    });

    const result = await decisionService().reject(request.id, actor, "  domínio não permitido  ");

    expect(result.request).toMatchObject({
      status: "REJECTED",
      activeEmail: null,
      rejectionReason: "domínio não permitido",
      reviewedById: actor.userId,
      reviewedAt: now,
    });
    expect(await prisma.emailVerificationToken.findUnique({ where: { accessRequestId: request.id } }))
      .toMatchObject({ revokedAt: now, usedAt: null });
    expect((await requests.findEvents(request.id)).at(-1)).toMatchObject({
      fromStatus: "PENDING_REVIEW",
      toStatus: "REJECTED",
      actorId: actor.userId,
      reason: "domínio não permitido",
      createdAt: now,
    });
    expect(await requests.findActiveByEmail(request.email)).toBeNull();
    expect(await prisma.accessInvitation.count()).toBe(0);
  });

  it("commita expiração e liberação da reserva antes de retornar ACCESS_REQUEST_EXPIRED", async () => {
    const actor = await seedAdmin();
    const request = await createPendingReview();
    now = new Date(request.expiresAt.getTime() + 1);

    await expect(decisionService().approve(request.id, actor)).rejects.toThrow("ACCESS_REQUEST_EXPIRED");

    expect(await requests.findById(request.id)).toMatchObject({ status: "EXPIRED", activeEmail: null });
    expect((await requests.findEvents(request.id)).at(-1)).toMatchObject({
      fromStatus: "PENDING_REVIEW",
      toStatus: "EXPIRED",
      actorId: null,
      createdAt: now,
    });
    expect(await prisma.accessInvitation.count()).toBe(0);
    expect(await prisma.auditLog.count()).toBe(0);
  });

  it("reject de pedido vencido commita EXPIRED e libera a reserva antes do 422", async () => {
    const actor = await seedAdmin();
    const request = await createPendingReview();
    now = new Date(request.expiresAt.getTime() + 1);

    await expect(decisionService().reject(request.id, actor, "motivo não deve ser aplicado"))
      .rejects.toThrow("ACCESS_REQUEST_EXPIRED");

    expect(await requests.findById(request.id)).toMatchObject({
      status: "EXPIRED",
      activeEmail: null,
      reviewedById: null,
      rejectionReason: null,
    });
    expect((await requests.findEvents(request.id)).at(-1)).toMatchObject({
      fromStatus: "PENDING_REVIEW",
      toStatus: "EXPIRED",
      actorId: null,
      reason: null,
      createdAt: now,
    });
    expect(await requests.findActiveByEmail(request.email)).toBeNull();
    expect(await prisma.accessInvitation.count()).toBe(0);
    expect(await prisma.auditLog.count()).toBe(0);
  });

  it("uma aprovação concorrente a rejeição vence sozinha", async () => {
    const adminA = await seedAdmin("decision-admin-a@vulnera.local");
    const adminB = await seedAdmin("decision-admin-b@vulnera.local");
    const request = await createPendingReview();
    const service = decisionService();

    const outcomes = await Promise.allSettled([
      service.approve(request.id, adminA),
      service.reject(request.id, adminB, "rejeição concorrente"),
    ]);

    expect(outcomes.filter(outcome => outcome.status === "fulfilled")).toHaveLength(1);
    const loser = outcomes.find(outcome => outcome.status === "rejected");
    expect(loser).toMatchObject({ status: "rejected", reason: { message: "INVALID_STATUS_TRANSITION" } });
    const final = await requests.findById(request.id);
    expect(["APPROVED", "REJECTED"]).toContain(final?.status);
    expect(await prisma.accessRequestEvent.count({ where: { accessRequestId: request.id } })).toBe(3);
    expect(await prisma.accessInvitation.count({ where: { accessRequestId: request.id } }))
      .toBe(final?.status === "APPROVED" ? 1 : 0);
  });

  it("aprovações simultâneas e repetidas criam um único convite e um envio", async () => {
    const actor = await seedAdmin();
    const request = await createPendingReview();
    const sender = new FakeEmailSender();
    const service = decisionService(sender);

    const outcomes = await Promise.allSettled([
      service.approve(request.id, actor),
      service.approve(request.id, actor),
    ]);
    expect(outcomes.filter(outcome => outcome.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.find(outcome => outcome.status === "rejected"))
      .toMatchObject({ status: "rejected", reason: { message: "INVALID_STATUS_TRANSITION" } });
    await expect(service.approve(request.id, actor)).rejects.toThrow("INVALID_STATUS_TRANSITION");
    expect(sender.messages).toHaveLength(1);
    expect(await prisma.accessInvitation.count({ where: { accessRequestId: request.id } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { entityId: request.id, action: "ACCESS_INVITATION_ISSUED" } })).toBe(1);
  });

  it("rollback total se a preparação do convite falhar", async () => {
    const actor = await seedAdmin();
    const request = await createPendingReview();
    const failingInvitation = {
      prepareInitial: jest.fn().mockRejectedValue(new Error("ACCESS_INVITATION_PERSISTENCE_FAILED")),
      sendPrepared: jest.fn(),
    } as unknown as Pick<AccessInvitationService, "prepareInitial" | "sendPrepared">;
    const service = new AdminAccessRequestDecisionService(requests, failingInvitation, authorization, () => new Date(now));

    await expect(service.approve(request.id, actor)).rejects.toThrow("ACCESS_INVITATION_PERSISTENCE_FAILED");

    expect(await requests.findById(request.id)).toEqual(request);
    expect(await prisma.accessRequestEvent.count({ where: { accessRequestId: request.id } })).toBe(2);
    expect(await prisma.accessInvitation.count()).toBe(0);
    expect(await prisma.auditLog.count()).toBe(0);
    expect(failingInvitation.sendPrepared).not.toHaveBeenCalled();
  });

  it("reverte a aprovação, o slot e a auditoria se o AuditLog falhar após as escritas reais", async () => {
    const actor = await seedAdmin();
    const request = await createPendingReview();
    const sender = new FakeEmailSender();
    const persistAudit = AccessRequestRepository.prototype.createInvitationAuditEvent;
    const auditSpy = jest.spyOn(AccessRequestRepository.prototype, "createInvitationAuditEvent")
      .mockImplementation(async function (
        this: AccessRequestRepository,
        ...args: Parameters<AccessRequestRepository["createInvitationAuditEvent"]>
      ) {
        await persistAudit.apply(this, args);
        throw new Error("INJECTED_AUDIT_FAILURE_AFTER_WRITE");
      });

    try {
      await expect(decisionService(sender).approve(request.id, actor))
        .rejects.toThrow("ACCESS_INVITATION_PERSISTENCE_FAILED");

      expect(auditSpy).toHaveBeenCalledTimes(1);
      expect(await requests.findById(request.id)).toEqual(request);
      expect(await prisma.accessRequestEvent.count({ where: { accessRequestId: request.id } })).toBe(2);
      expect(await prisma.accessInvitation.count({ where: { accessRequestId: request.id } })).toBe(0);
      expect(await prisma.auditLog.count({ where: { entityId: request.id } })).toBe(0);
      expect(sender.messages).toHaveLength(0);
    } finally {
      auditSpy.mockRestore();
    }
  });

  it("usa a collation de User.email para bloquear aprovação quando já existe conta equivalente", async () => {
    const actor = await seedAdmin();
    const request = await createPendingReview("existing-account@empresa.local");
    await seedUser({
      name: "Conta anterior",
      email: "EXISTING-ACCOUNT@EMPRESA.LOCAL",
      password: PASSWORD,
      role: "CLIENT",
    });

    await expect(decisionService().approve(request.id, actor)).rejects.toThrow("ACCESS_REQUEST_USER_ALREADY_EXISTS");

    expect(await requests.findById(request.id)).toEqual(request);
    expect(await prisma.accessInvitation.count()).toBe(0);
    expect(await prisma.auditLog.count()).toBe(0);
  });

  it("revalida ADMIN antes de consultar ou bloquear o pedido", async () => {
    const client = await seedUser({
      name: "Usuário cliente",
      email: "decision-client@empresa.local",
      password: PASSWORD,
      role: "CLIENT",
    });
    const transactionSpy = jest.spyOn(requests, "transactionWithRetry");
    const service = decisionService();

    await expect(service.approve("id-que-nao-existe", { userId: client.id, role: "CLIENT" }))
      .rejects.toThrow("FORBIDDEN");
    expect(transactionSpy).not.toHaveBeenCalled();
    expect(await prisma.accessRequest.count()).toBe(0);
  });

  it("mantém a decisão aprovada se o SMTP falhar e revoga o convite preparado", async () => {
    const actor = await seedAdmin();
    const request = await createPendingReview();
    const sender = new FakeEmailSender({ fail: true });

    const result = await decisionService(sender).approve(request.id, actor);

    expect(result).toMatchObject({ request: { status: "APPROVED" }, invitationDelivery: "DELIVERY_FAILED" });
    expect(await prisma.accessInvitation.findUnique({ where: { accessRequestId: request.id } }))
      .toMatchObject({ revokedAt: now, usedAt: null });
    expect(await prisma.auditLog.findMany({ where: { entityId: request.id }, orderBy: { createdAt: "asc" } }))
      .toMatchObject([
        { action: "ACCESS_INVITATION_ISSUED", actorId: actor.userId, diffJson: null },
        { action: "ACCESS_INVITATION_DELIVERY_FAILED", actorId: actor.userId, diffJson: null },
      ]);
  });

  it("reject sem motivo persiste null e libera a reserva", async () => {
    const actor = await seedAdmin();
    const request = await createPendingReview();

    const result = await decisionService().reject(request.id, actor);

    expect(result.request).toMatchObject({ status: "REJECTED", activeEmail: null, rejectionReason: null });
    expect(await requests.findActiveByEmail(request.email)).toBeNull();
  });
});
