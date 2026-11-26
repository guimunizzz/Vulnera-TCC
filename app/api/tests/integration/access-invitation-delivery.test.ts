/**
 * Exercita emissão e reenvio administrativo de convites no MySQL isolado.
 * Confirma hash, prazos, auditoria, locks e entrega posterior ao commit.
 */
import { prisma } from "../../src/database/prisma.database";
import {
  AccessRequestEntity,
  type AccessRequest,
  type AccessRequestStatus,
  type CreateAccessRequestDTO,
} from "../../src/models/access-request.model";
import type { AccessRequestAdminActor } from "../../src/models/admin-access-request.model";
import { AccessInvitationCooldownError } from "../../src/models/access-invitation.model";
import type { EmailMessage } from "../../src/models/email.model";
import { AccessInvitationRepository } from "../../src/repositories/access-invitation.repository";
import { AccessRequestRepository } from "../../src/repositories/access-request.repository";
import { UserRepository } from "../../src/repositories/user.repository";
import { AccessRequestAdminAuthorizationService } from "../../src/services/access-request-admin-authorization.service";
import { AccessInvitationService } from "../../src/services/access-invitation.service";
import { hashAccessToken } from "../../src/utils/access-token.util";
import { cleanDatabase } from "../setup";
import { FakeEmailSender } from "../fixtures/fake-email-sender";
import { seedUser } from "../fixtures/users.fixture";

const requests = new AccessRequestRepository(prisma);
const invitations = new AccessInvitationRepository(prisma);
const PUBLIC_WEB_URL = "https://app.vulnera.example";
const PASSWORD = "Test-admin-password";
const INITIAL_TIME = new Date("2026-10-20T12:00:00.000Z");
const HOUR_MS = 3_600_000;

let now: Date;
let sequence: number;
let sender: FakeEmailSender;
let service: AccessInvitationService;
let actor: AccessRequestAdminActor;

beforeEach(async () => {
  await cleanDatabase();
  now = new Date(INITIAL_TIME);
  sequence = 0;
  sender = new FakeEmailSender();
  const admin = await seedUser({
    name: "Admin de convites",
    email: "access-invitation-admin@empresa.local",
    password: PASSWORD,
    role: "ADMIN",
  });
  actor = { userId: admin.id, role: "ADMIN" };
  service = makeService(sender);
});

afterEach(() => {
  jest.restoreAllMocks();
});

function makeService(emailSender: FakeEmailSender, cooldownMs = 60_000): AccessInvitationService {
  return new AccessInvitationService(
    requests,
    emailSender,
    PUBLIC_WEB_URL,
    new AccessRequestAdminAuthorizationService(new UserRepository(prisma)),
    { clock: () => new Date(now), cooldownMs },
  );
}

async function createRequest(overrides: Partial<CreateAccessRequestDTO> = {}): Promise<AccessRequest> {
  sequence += 1;
  const row = await requests.createIfEmailAvailable({
    name: "Pessoa solicitante",
    email: `access-invitation-${sequence}@empresa.local`,
    companyName: "Empresa declarada",
    ...overrides,
  }, now);
  expect(row).not.toBeNull();
  return row!;
}

async function moveRequest(
  row: AccessRequest,
  status: AccessRequestStatus,
  at = now,
  admin = actor,
): Promise<AccessRequest> {
  const change = new AccessRequestEntity(row).transitionTo(status, admin, undefined, at);
  expect(await requests.transitionIfCurrent(row.id, change)).toBe(true);
  return (await requests.findById(row.id))!;
}

async function createApprovedRequest(overrides: Partial<CreateAccessRequestDTO> = {}): Promise<AccessRequest> {
  const row = await createRequest(overrides);
  const inReview = await moveRequest(row, "PENDING_REVIEW");
  return moveRequest(inReview, "APPROVED");
}

function tokenFrom(message: EmailMessage): string {
  const match = message.text.match(/#token=([A-Za-z0-9_-]{43})/u);
  expect(match).not.toBeNull();
  return match![1];
}

async function findInvitation(accessRequestId: string) {
  return prisma.accessInvitation.findUnique({ where: { accessRequestId } });
}

async function auditActions(accessRequestId: string): Promise<string[]> {
  const logs = await prisma.auditLog.findMany({
    where: { entityType: "AccessRequest", entityId: accessRequestId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  return logs.map((log) => log.action);
}

describe("AccessInvitationService — preparo e entrega", () => {
  it("persiste só o hash e a auditoria antes do SMTP, com TTL de 48 horas", async () => {
    const row = await createApprovedRequest({ name: "<Ana & Cia>" });
    let persistedBeforeSend = false;
    const observingSender = new FakeEmailSender({
      beforeSend: async (message) => {
        const token = tokenFrom(message);
        const slot = await findInvitation(row.id);
        const actions = await auditActions(row.id);
        const changedAt = new Date(now.getTime() + 1);
        const changed = await prisma.accessRequest.update({ where: { id: row.id }, data: { updatedAt: changedAt } });

        persistedBeforeSend = slot !== null
          && slot.tokenHash === hashAccessToken(token)
          && !JSON.stringify(slot).includes(token)
          && actions.includes("ACCESS_INVITATION_ISSUED")
          && changed.updatedAt.getTime() === changedAt.getTime();
        expect(message.text).toContain("/activate-account#token=");
        expect(message.html).toContain("&lt;Ana &amp; Cia&gt;");
      },
    });
    service = makeService(observingSender);

    const result = await service.resend(row.id, actor);

    expect(result.invitationDelivery).toBe("SENT");
    expect(result.request.id).toBe(row.id);
    expect(JSON.stringify(result)).not.toContain(tokenFrom(observingSender.messages[0]));
    expect(persistedBeforeSend).toBe(true);
    expect((await findInvitation(row.id))?.expiresAt).toEqual(new Date(now.getTime() + 48 * HOUR_MS));
    expect(await auditActions(row.id)).toEqual(["ACCESS_INVITATION_ISSUED"]);
    expect(await prisma.company.count()).toBe(0);
    expect(await prisma.subscription.count()).toBe(0);
    expect(await prisma.refreshToken.count()).toBe(0);
  });

  it("prepara o convite inicial na transação recebida e limita o prazo ao pedido", async () => {
    const row = await createApprovedRequest();
    const shortenedDeadline = new Date(now.getTime() + 30 * 60_000);
    await prisma.accessRequest.update({ where: { id: row.id }, data: { expiresAt: shortenedDeadline } });

    const prepared = await requests.transaction((repositories) => service.prepareInitial(
      repositories,
      row.id,
      actor,
      now,
    ));
    expect(await service.sendPrepared(prepared)).toBe("SENT");

    expect((await findInvitation(row.id))?.expiresAt).toEqual(shortenedDeadline);
    expect(await auditActions(row.id)).toEqual(["ACCESS_INVITATION_ISSUED"]);
    expect(await invitations.findByHash(hashAccessToken(prepared.token))).not.toBeNull();
  });

  it("após falha SMTP revoga só o hash preparado e permite recuperar após cooldown", async () => {
    const row = await createApprovedRequest();
    const attempted: EmailMessage[] = [];
    const failedSender = new FakeEmailSender({
      fail: true,
      beforeSend: (message) => { attempted.push(message); },
    });
    service = makeService(failedSender);

    const failed = await service.resend(row.id, actor);
    const failedToken = tokenFrom(attempted[0]);
    const revoked = await findInvitation(row.id);
    expect(failed.invitationDelivery).toBe("DELIVERY_FAILED");
    expect(revoked).toMatchObject({ revokedAt: now, usedAt: null });
    expect((await auditActions(row.id)).sort()).toEqual([
      "ACCESS_INVITATION_ISSUED",
      "ACCESS_INVITATION_DELIVERY_FAILED",
    ].sort());

    now = new Date(now.getTime() + 60_000);
    const recoverySender = new FakeEmailSender();
    service = makeService(recoverySender);
    expect((await service.resend(row.id, actor)).invitationDelivery).toBe("SENT");
    const recoveryToken = tokenFrom(recoverySender.messages[0]);
    expect(recoveryToken).not.toBe(failedToken);
    expect(await invitations.consumeIfAvailable(hashAccessToken(failedToken), now)).toBe(false);
    expect((await findInvitation(row.id))?.tokenHash).toBe(hashAccessToken(recoveryToken));
  });

  it("rejeita o token anterior depois de reemitir convite vencido sem estender aprovação", async () => {
    const row = await createApprovedRequest();
    expect((await service.resend(row.id, actor)).invitationDelivery).toBe("SENT");
    const oldToken = tokenFrom(sender.messages[0]);
    const approvalDeadline = row.expiresAt;
    now = new Date(now.getTime() + 49 * HOUR_MS);

    const reissued = await service.resend(row.id, actor);
    const newToken = tokenFrom(sender.messages[1]);

    expect(reissued.invitationDelivery).toBe("SENT");
    expect(newToken).not.toBe(oldToken);
    expect(await invitations.consumeIfAvailable(hashAccessToken(oldToken), now)).toBe(false);
    expect(await prisma.user.findUnique({ where: { email: row.email } })).toBeNull();
    expect((await requests.findById(row.id))?.expiresAt).toEqual(approvalDeadline);
    expect(await auditActions(row.id)).toEqual([
      "ACCESS_INVITATION_ISSUED",
      "ACCESS_INVITATION_REISSUED",
    ]);
  });

  it("falha de um SMTP atrasado não revoga a geração emitida depois", async () => {
    const row = await createApprovedRequest();
    let signalFirstSend!: () => void;
    let releaseFirstSend!: () => void;
    const firstSendStarted = new Promise<void>((resolve) => { signalFirstSend = resolve; });
    const release = new Promise<void>((resolve) => { releaseFirstSend = resolve; });
    const messages: EmailMessage[] = [];
    const delayedSender = {
      async send(message: EmailMessage): Promise<void> {
        messages.push({ ...message });
        if (messages.length === 1) {
          signalFirstSend();
          await release;
          throw new Error("EMAIL_DELIVERY_FAILED");
        }
      },
    };
    service = new AccessInvitationService(
      requests,
      delayedSender,
      PUBLIC_WEB_URL,
      new AccessRequestAdminAuthorizationService(new UserRepository(prisma)),
      { clock: () => new Date(now), cooldownMs: 60_000 },
    );

    const firstDelivery = service.resend(row.id, actor);
    await firstSendStarted;
    now = new Date(now.getTime() + 60_000);
    expect((await service.resend(row.id, actor)).invitationDelivery).toBe("SENT");
    const newestToken = tokenFrom(messages[1]);
    releaseFirstSend();
    expect((await firstDelivery).invitationDelivery).toBe("DELIVERY_FAILED");

    expect((await findInvitation(row.id))?.tokenHash).toBe(hashAccessToken(newestToken));
    expect((await findInvitation(row.id))?.revokedAt).toBeNull();
    expect(await auditActions(row.id)).toEqual([
      "ACCESS_INVITATION_ISSUED",
      "ACCESS_INVITATION_REISSUED",
    ]);
  });

  it("aplica cooldown persistente compartilhado entre dois administradores concorrentes", async () => {
    const row = await createApprovedRequest();
    const secondAdmin = await seedUser({
      name: "Segundo admin",
      email: "access-invitation-admin-2@empresa.local",
      password: PASSWORD,
      role: "ADMIN",
    });
    const secondActor: AccessRequestAdminActor = { userId: secondAdmin.id, role: "ADMIN" };

    const results = await Promise.allSettled([
      service.resend(row.id, actor),
      service.resend(row.id, secondActor),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected");
    expect(rejected?.status).toBe("rejected");
    if (rejected?.status === "rejected") {
      expect(rejected.reason).toBeInstanceOf(AccessInvitationCooldownError);
      expect(rejected.reason.retryAfterSeconds).toBe(60);
    }
    expect(await findInvitation(row.id)).not.toBeNull();
    expect(await auditActions(row.id)).toEqual(["ACCESS_INVITATION_ISSUED"]);
  });

  it("bloqueia reemissão após consumo e não reativa pedidos ACTIVATED", async () => {
    const consumedRequest = await createApprovedRequest();
    expect((await service.resend(consumedRequest.id, actor)).invitationDelivery).toBe("SENT");
    const consumedSlot = await findInvitation(consumedRequest.id);
    expect(await invitations.consumeIfAvailable(consumedSlot!.tokenHash, now)).toBe(true);
    await expect(service.resend(consumedRequest.id, actor)).rejects.toThrow("ACCESS_INVITATION_ALREADY_USED");

    const activatedRequest = await createApprovedRequest();
    const activated = await moveRequest(activatedRequest, "ACTIVATED");
    expect(activated.status).toBe("ACTIVATED");
    await expect(service.resend(activatedRequest.id, actor)).rejects.toThrow("INVALID_STATUS_TRANSITION");
  });

  it("não emite convite quando já existe User equivalente ao e-mail do pedido", async () => {
    const row = await createApprovedRequest();
    await seedUser({
      name: "Conta criada por outro fluxo",
      email: row.email,
      password: PASSWORD,
      role: "CLIENT",
    });

    await expect(service.resend(row.id, actor)).rejects.toThrow("ACCESS_REQUEST_USER_ALREADY_EXISTS");

    expect(await findInvitation(row.id)).toBeNull();
    expect(await auditActions(row.id)).toEqual([]);
    expect(sender.messages).toHaveLength(0);
  });

  it("expira e libera a aprovação vencida antes de retornar o erro de negócio", async () => {
    const row = await createApprovedRequest();
    expect((await service.resend(row.id, actor)).invitationDelivery).toBe("SENT");
    const approved = await requests.findById(row.id);
    now = new Date(approved!.expiresAt.getTime());

    await expect(service.resend(row.id, actor)).rejects.toThrow("ACCESS_REQUEST_EXPIRED");

    expect(await requests.findById(row.id)).toMatchObject({ status: "EXPIRED", activeEmail: null });
    expect((await findInvitation(row.id))?.revokedAt).toEqual(now);
  });

  it("revalida ADMIN antes de consultar o pedido", async () => {
    const denied = new AccessInvitationService(
      requests,
      sender,
      PUBLIC_WEB_URL,
      { ensureAdmin: async () => { throw new Error("FORBIDDEN"); } },
      { clock: () => new Date(now) },
    );

    await expect(denied.resend("missing-request", { userId: actor.userId, role: "CLIENT" }))
      .rejects.toThrow("FORBIDDEN");
  });

  it("traduz falha de cleanup para código seguro sem expor detalhes do banco", async () => {
    const row = await createApprovedRequest();
    const failedSender = new FakeEmailSender({ fail: true });
    service = makeService(failedSender);
    const cleanup = jest.spyOn(AccessInvitationRepository.prototype, "revokeIfAvailable")
      .mockRejectedValue(new Error("database detail must stay private"));

    await expect(service.resend(row.id, actor)).rejects.toThrow("ACCESS_INVITATION_CLEANUP_FAILED");

    cleanup.mockRestore();
    expect((await findInvitation(row.id))?.revokedAt).toBeNull();
    expect(await auditActions(row.id)).toEqual(["ACCESS_INVITATION_ISSUED"]);
  });

  it("expõe falha de SMTP sem gravar o token bruto no banco ou na auditoria", async () => {
    const row = await createApprovedRequest();
    const attempted: EmailMessage[] = [];
    service = makeService(new FakeEmailSender({ fail: true, beforeSend: (message) => { attempted.push(message); } }));

    expect((await service.resend(row.id, actor)).invitationDelivery).toBe("DELIVERY_FAILED");

    const token = tokenFrom(attempted[0]);
    const slot = await findInvitation(row.id);
    const audit = await prisma.auditLog.findMany({ where: { entityType: "AccessRequest", entityId: row.id } });
    expect(slot?.tokenHash).toBe(hashAccessToken(token));
    expect(JSON.stringify(slot)).not.toContain(token);
    expect(JSON.stringify(audit)).not.toContain(token);
    expect(JSON.stringify(audit)).not.toContain(slot!.tokenHash);
  });
});
