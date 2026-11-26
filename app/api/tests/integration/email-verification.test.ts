/**
 * Exercita o fluxo de verificação por e-mail contra MySQL real e isolado.
 * Confirma atomicidade, prazos e uso único antes de qualquer futura rota HTTP.
 */
import { prisma } from "../../src/database/prisma.database";
import {
  AccessRequestEntity,
  type AccessRequest,
  type AccessRequestStatus,
  type CreateAccessRequestDTO,
} from "../../src/models/access-request.model";
import type { EmailMessage, EmailSender } from "../../src/models/email.model";
import { EmailVerificationService } from "../../src/services/email-verification.service";
import { AccessRequestRepository } from "../../src/repositories/access-request.repository";
import { EmailVerificationTokenRepository } from "../../src/repositories/email-verification-token.repository";
import { generateAccessToken, hashAccessToken } from "../../src/utils/access-token.util";
import { cleanDatabase } from "../setup";
import { FakeEmailSender } from "../fixtures/fake-email-sender";
import { seedUser } from "../fixtures/users.fixture";

const requests = new AccessRequestRepository(prisma);
const verificationTokens = new EmailVerificationTokenRepository(prisma);
const PUBLIC_WEB_URL = "https://app.vulnera.example";
const DAY_MS = 86_400_000;
const INITIAL_TIME = new Date("2026-04-12T12:00:00.000Z");
const PASSWORD = "Test-admin-password";

let now: Date;
let sequence: number;
let sender: FakeEmailSender;
let service: EmailVerificationService;

beforeEach(async () => {
  await cleanDatabase();
  now = new Date(INITIAL_TIME);
  sequence = 0;
  sender = new FakeEmailSender();
  service = new EmailVerificationService(requests, sender, PUBLIC_WEB_URL, () => new Date(now));
});

afterEach(() => {
  jest.restoreAllMocks();
});

async function createRequest(
  overrides: Partial<CreateAccessRequestDTO> = {},
  createdAt = now,
): Promise<AccessRequest> {
  sequence += 1;
  const dto: CreateAccessRequestDTO = {
    name: "Pessoa solicitante",
    email: `email-verification-${sequence}@empresa.local`,
    companyName: "Empresa declarada",
    ...overrides,
  };
  const row = await requests.createIfEmailAvailable(dto, createdAt);
  expect(row).not.toBeNull();
  return row!;
}

async function moveRequest(
  row: AccessRequest,
  status: AccessRequestStatus,
  at = now,
  actor?: { userId: string; role: "ADMIN" },
): Promise<AccessRequest> {
  const change = new AccessRequestEntity(row).transitionTo(status, actor, undefined, at);
  expect(await requests.transitionIfCurrent(row.id, change)).toBe(true);
  return (await requests.findById(row.id))!;
}

function tokenFrom(message: EmailMessage): string {
  const match = message.text.match(/#token=([A-Za-z0-9_-]{43})/u);
  expect(match).not.toBeNull();
  return match![1];
}

async function findSlot(accessRequestId: string) {
  return prisma.emailVerificationToken.findUnique({ where: { accessRequestId } });
}

async function sendInitialVerification(id: string): Promise<string> {
  expect(await service.issueVerification(id)).toBe("SENT");
  expect(sender.messages).toHaveLength(1);
  return tokenFrom(sender.messages[0]);
}

describe("EmailVerificationService — persistência e entrega", () => {
  it("grava apenas o hash e o evento antes do envio, com commit confirmado", async () => {
    const row = await createRequest();
    let persistedWhenSent = false;
    const observingSender: EmailSender = {
      async send(message) {
        const rawToken = tokenFrom(message);
        const slot = await findSlot(row.id);
        const eventTypes = (await requests.findEvents(row.id)).map((event) => event.eventType);
        const otherOperationAt = new Date(now.getTime() + 1);
        const changed = await prisma.accessRequest.update({
          where: { id: row.id },
          data: { updatedAt: otherOperationAt },
        });

        persistedWhenSent = slot !== null
          && slot.tokenHash === hashAccessToken(rawToken)
          && !JSON.stringify(slot).includes(rawToken)
          && eventTypes.includes("VERIFICATION_ISSUED")
          && changed.updatedAt.getTime() === otherOperationAt.getTime();
      },
    };
    service = new EmailVerificationService(requests, observingSender, PUBLIC_WEB_URL, () => new Date(now));

    expect(await service.issueVerification(row.id)).toBe("SENT");
    expect(persistedWhenSent).toBe(true);
    expect((await findSlot(row.id))?.expiresAt).toEqual(new Date(now.getTime() + 60 * 60_000));
    expect(await prisma.accessRequest.count()).toBe(1);
    expect(await prisma.user.count()).toBe(0);
    expect(await prisma.company.count()).toBe(0);
    expect(await prisma.subscription.count()).toBe(0);
    expect(await prisma.refreshToken.count()).toBe(0);
    expect(await prisma.auditLog.count()).toBe(0);
  });

  it("limita a validade do token ao menor prazo entre uma hora e o pedido", async () => {
    const almostExpiredAt = new Date(now.getTime() - 7 * DAY_MS + 15 * 60_000);
    const row = await createRequest({}, almostExpiredAt);

    expect(row.expiresAt.getTime() - now.getTime()).toBe(15 * 60_000);
    expect(await service.issueVerification(row.id)).toBe("SENT");
    const slot = await findSlot(row.id);
    expect(slot?.expiresAt).toEqual(row.expiresAt);
  });

  it("confirma um token canônico uma única vez e mantém a reserva na revisão", async () => {
    const row = await createRequest();
    const token = await sendInitialVerification(row.id);

    expect(await service.confirmEmail(token)).toBe(true);
    expect(await service.confirmEmail(token)).toBe(false);
    expect(await requests.findById(row.id)).toMatchObject({
      status: "PENDING_REVIEW",
      activeEmail: row.email,
      emailVerifiedAt: now,
      expiresAt: new Date(now.getTime() + 30 * DAY_MS),
    });
    expect((await requests.findActiveByEmail(row.email))?.id).toBe(row.id);
    expect((await findSlot(row.id))?.usedAt).toEqual(now);
    expect(await prisma.user.count()).toBe(0);
    expect(await prisma.company.count()).toBe(0);
    expect(await prisma.subscription.count()).toBe(0);
    expect(await prisma.refreshToken.count()).toBe(0);
    const eventTypes = (await requests.findEvents(row.id)).map((event) => event.eventType);
    expect(eventTypes.filter((eventType) => eventType === "STATUS_TRANSITION")).toHaveLength(2);
    expect(eventTypes).toContain("VERIFICATION_ISSUED");
  });

  it.each([
    "",
    "not-a-token",
    "A".repeat(42),
    `${"A".repeat(42)}B`,
    `${"A".repeat(43)}=`,
  ])("recusa segredo inválido ou não canônico %j sem revelar a existência", async (rawToken) => {
    const row = await createRequest();
    await sendInitialVerification(row.id);
    const before = await findSlot(row.id);

    expect(await service.confirmEmail(rawToken)).toBe(false);
    expect(await findSlot(row.id)).toEqual(before);
    expect((await requests.findById(row.id))?.status).toBe("PENDING_EMAIL_VERIFICATION");
  });

  it("recusa token expirado sem consumir slot nem expirar antes o pedido", async () => {
    const row = await createRequest();
    const token = await sendInitialVerification(row.id);
    const before = await findSlot(row.id);
    now = new Date(before!.expiresAt.getTime() + 1);

    expect(await service.confirmEmail(token)).toBe(false);
    expect(await requests.findById(row.id)).toMatchObject({ status: "PENDING_EMAIL_VERIFICATION" });
    expect(await findSlot(row.id)).toMatchObject({ usedAt: null });
  });

  it("expira o pedido no próprio fluxo quando sua janela já terminou", async () => {
    const row = await createRequest({}, new Date(now.getTime() - 8 * DAY_MS));

    expect(await service.issueVerification(row.id)).toBe("NOT_ELIGIBLE");
    expect(await requests.findById(row.id)).toMatchObject({ status: "EXPIRED", activeEmail: null });
    expect(await prisma.emailVerificationToken.count()).toBe(0);
    expect(sender.messages).toHaveLength(0);
  });

  it("CHECK da trilha fecha os tipos de evento e protege as duas formas válidas", async () => {
    const row = await createRequest();
    expect(await service.issueVerification(row.id)).toBe("SENT");
    const admin = await seedUser({
      name: "Admin da fixture",
      email: "verification-event-admin@empresa.local",
      password: PASSWORD,
      role: "ADMIN",
    });
    const base = {
      accessRequestId: row.id,
      eventType: "VERIFICATION_ISSUED",
      fromStatus: "PENDING_EMAIL_VERIFICATION",
      toStatus: "PENDING_EMAIL_VERIFICATION",
      actorId: null as string | null,
      reason: null as string | null,
      createdAt: now,
    };
    const invalidEvents = [
      { ...base, eventType: "UNKNOWN_EVENT" },
      { ...base, eventType: "verification_issued" },
      { ...base, eventType: "STATUS_TRANSITION" },
      { ...base, fromStatus: null },
      { ...base, fromStatus: "PENDING_REVIEW" },
      { ...base, toStatus: "PENDING_REVIEW" },
      { ...base, reason: "evento de envio sem motivo permitido" },
      { ...base, actorId: admin.id },
    ];

    for (const event of invalidEvents) {
      await expect(prisma.accessRequestEvent.create({ data: event })).rejects.toThrow();
    }
    expect(await requests.findEvents(row.id)).toHaveLength(2);
  });

  it("não emite fora de PENDING_EMAIL_VERIFICATION", async () => {
    const admin = await seedUser({
      name: "Admin da fixture",
      email: "verification-state-admin@empresa.local",
      password: PASSWORD,
      role: "ADMIN",
    });
    const actor = { userId: admin.id, role: "ADMIN" as const };
    const states: AccessRequestStatus[] = ["PENDING_REVIEW", "APPROVED", "REJECTED", "EXPIRED", "ACTIVATED"];

    for (const state of states) {
      let row = await createRequest();
      if (state === "PENDING_REVIEW") {
        row = await moveRequest(row, state);
      } else if (state === "APPROVED" || state === "REJECTED") {
        row = await moveRequest(row, "PENDING_REVIEW");
        row = await moveRequest(row, state, now, actor);
      } else if (state === "EXPIRED") {
        row = await moveRequest(row, state, row.expiresAt);
      } else {
        row = await moveRequest(row, "PENDING_REVIEW");
        row = await moveRequest(row, "APPROVED", now, actor);
        row = await moveRequest(row, state);
      }

      expect(await service.issueVerification(row.id)).toBe("NOT_ELIGIBLE");
      expect(await service.resendVerification(row.id)).toBe("NOT_ELIGIBLE");
    }
    expect(sender.messages).toHaveLength(0);
    expect(await prisma.emailVerificationToken.count()).toBe(0);
  });

  it("a emissão inicial não substitui slot existente e slot consumido não pode ser reaberto", async () => {
    const row = await createRequest();
    const generated = generateAccessToken();
    const slot = await verificationTokens.createIfEligible({
      accessRequestId: row.id,
      tokenHash: generated.tokenHash,
      expiresAt: new Date(now.getTime() + 60 * 60_000),
    }, now);
    expect(slot).not.toBeNull();

    expect(await service.issueVerification(row.id)).toBe("CONFLICT");
    expect(await verificationTokens.consumeIfAvailable(generated.tokenHash, now)).toBe(true);
    expect(await service.resendVerification(row.id)).toBe("CONFLICT");
    expect(await findSlot(row.id)).toEqual({ ...slot, usedAt: now });
    expect(sender.messages).toHaveLength(0);
  });

  it("reemite token expirado sem estender a janela do pedido e invalida o link antigo", async () => {
    const row = await createRequest();
    const previous = await sendInitialVerification(row.id);
    const originalRequestDeadline = row.expiresAt;
    now = new Date(now.getTime() + 60 * 60_000 + 1);

    expect(await service.resendVerification(row.id)).toBe("SENT");
    const current = tokenFrom(sender.messages[1]);
    expect(current).not.toBe(previous);
    expect(await service.confirmEmail(previous)).toBe(false);
    expect(await requests.findById(row.id)).toMatchObject({
      status: "PENDING_EMAIL_VERIFICATION",
      expiresAt: originalRequestDeadline,
    });
    const events = (await requests.findEvents(row.id)).map((event) => event.eventType);
    expect(events).toContain("VERIFICATION_REISSUED");
    expect(await service.confirmEmail(current)).toBe(true);
  });

  it("reemite token ainda válido, substitui o link e mantém a janela do pedido", async () => {
    const row = await createRequest();
    const previous = await sendInitialVerification(row.id);

    expect(await service.resendVerification(row.id)).toBe("SENT");
    const current = tokenFrom(sender.messages[1]);
    expect(current).not.toBe(previous);
    expect(await service.confirmEmail(previous)).toBe(false);
    expect(await requests.findById(row.id)).toMatchObject({ expiresAt: row.expiresAt, status: "PENDING_EMAIL_VERIFICATION" });
    expect(await service.confirmEmail(current)).toBe(true);
  });

  it("permite resend como recuperação quando o pedido ainda não tem slot", async () => {
    const row = await createRequest();

    expect(await service.resendVerification(row.id)).toBe("SENT");
    expect(await prisma.emailVerificationToken.count()).toBe(1);
    expect((await requests.findEvents(row.id)).map((event) => event.eventType)).toContain("VERIFICATION_ISSUED");
    expect(await service.confirmEmail(tokenFrom(sender.messages[0]))).toBe(true);
  });

  it("falha de envio revoga somente o hash preparado e permite nova tentativa", async () => {
    const row = await createRequest();
    const failingSender = new FakeEmailSender({ fail: true });
    service = new EmailVerificationService(requests, failingSender, PUBLIC_WEB_URL, () => new Date(now));

    expect(await service.issueVerification(row.id)).toBe("DELIVERY_FAILED");
    const revoked = await findSlot(row.id);
    expect(revoked).toMatchObject({ revokedAt: now, usedAt: null });
    expect((await requests.findEvents(row.id)).map((event) => event.eventType)).toContain("VERIFICATION_DELIVERY_FAILED");

    sender = new FakeEmailSender();
    service = new EmailVerificationService(requests, sender, PUBLIC_WEB_URL, () => new Date(now));
    expect(await service.resendVerification(row.id)).toBe("SENT");
    const next = await findSlot(row.id);
    expect(next?.tokenHash).not.toBe(revoked?.tokenHash);
    expect(next?.revokedAt).toBeNull();
    expect(await service.confirmEmail(tokenFrom(sender.messages[0]))).toBe(true);
  });

  it("cleanup tardio após falha não revoga uma emissão concorrente mais nova", async () => {
    const row = await createRequest();
    let signalFirstSend!: () => void;
    let releaseFirstSend!: () => void;
    const firstSendStarted = new Promise<void>((resolve) => { signalFirstSend = resolve; });
    const release = new Promise<void>((resolve) => { releaseFirstSend = resolve; });
    const delayedMessages: EmailMessage[] = [];
    const delayedSender: EmailSender = {
      async send(message) {
        delayedMessages.push({ ...message });
        if (delayedMessages.length === 1) {
          signalFirstSend();
          await release;
          throw new Error("EMAIL_DELIVERY_FAILED");
        }
      },
    };
    service = new EmailVerificationService(requests, delayedSender, PUBLIC_WEB_URL, () => new Date(now));

    const firstDelivery = service.issueVerification(row.id);
    await firstSendStarted;
    expect(await service.resendVerification(row.id)).toBe("SENT");
    const secondToken = tokenFrom(delayedMessages[1]);
    releaseFirstSend();
    expect(await firstDelivery).toBe("DELIVERY_FAILED");

    const latest = await findSlot(row.id);
    expect(latest?.tokenHash).toBe(hashAccessToken(secondToken));
    expect(latest?.revokedAt).toBeNull();
    expect(await service.confirmEmail(secondToken)).toBe(true);
  });

  it("serializa duas confirmações concorrentes e registra uma só transição", async () => {
    const row = await createRequest();
    const token = await sendInitialVerification(row.id);

    const results = await Promise.all([service.confirmEmail(token), service.confirmEmail(token)]);
    expect(results.sort()).toEqual([false, true]);
    expect((await requests.findEvents(row.id)).filter((event) => event.toStatus === "PENDING_REVIEW")).toHaveLength(1);
    expect(await prisma.emailVerificationToken.count({ where: { accessRequestId: row.id, usedAt: { not: null } } })).toBe(1);
  });

  it("serializa dois reenvios e apenas o último segredo fica utilizável", async () => {
    const row = await createRequest();

    expect(await service.issueVerification(row.id)).toBe("SENT");
    const results = await Promise.all([service.resendVerification(row.id), service.resendVerification(row.id)]);
    expect(results).toEqual(["SENT", "SENT"]);
    expect(sender.messages).toHaveLength(3);

    const tokens = sender.messages.slice(1).map(tokenFrom);
    const confirmations = await Promise.all(tokens.map((token) => service.confirmEmail(token)));
    expect(confirmations.filter(Boolean)).toHaveLength(1);
    expect((await requests.findEvents(row.id)).filter((event) => event.eventType === "VERIFICATION_REISSUED")).toHaveLength(2);
  });

  it("resolve reenvio concorrente com confirmação sem consumo duplicado", async () => {
    const row = await createRequest();
    const oldToken = await sendInitialVerification(row.id);

    const [resendResult, confirmationResult] = await Promise.all([
      service.resendVerification(row.id),
      service.confirmEmail(oldToken),
    ]);

    expect(["SENT", "NOT_ELIGIBLE"]).toContain(resendResult);
    expect(typeof confirmationResult).toBe("boolean");
    if (confirmationResult) {
      expect(resendResult).toBe("NOT_ELIGIBLE");
      expect((await requests.findById(row.id))?.status).toBe("PENDING_REVIEW");
    } else {
      expect(resendResult).toBe("SENT");
      expect(await service.confirmEmail(tokenFrom(sender.messages[1]))).toBe(true);
    }
    expect((await requests.findEvents(row.id)).filter((event) => event.toStatus === "PENDING_REVIEW")).toHaveLength(1);
  });

  it("reverte o consumo do segredo quando a transição de estado perde o CAS", async () => {
    const row = await createRequest();
    const token = await sendInitialVerification(row.id);
    const transition = jest.spyOn(AccessRequestRepository.prototype, "transitionIfCurrent").mockResolvedValue(false);

    await expect(service.confirmEmail(token)).rejects.toThrow("ACCESS_VERIFICATION_TRANSITION_CONFLICT");
    transition.mockRestore();
    expect(await requests.findById(row.id)).toMatchObject({ status: "PENDING_EMAIL_VERIFICATION" });
    expect(await findSlot(row.id)).toMatchObject({ usedAt: null });
    expect((await requests.findEvents(row.id)).filter((event) => event.toStatus === "PENDING_REVIEW")).toHaveLength(0);
    expect(await service.confirmEmail(token)).toBe(true);
  });

  it("reverte consumo e mudança do pedido quando o CHECK rejeita o evento STATUS_TRANSITION", async () => {
    const row = await createRequest();
    const token = await sendInitialVerification(row.id);
    const validTransition = new AccessRequestEntity(row).transitionTo("PENDING_REVIEW", undefined, undefined, now);
    const invalidTransition = { ...validTransition, reason: "motivo proibido pela trilha" };
    const transition = jest.spyOn(AccessRequestEntity.prototype, "transitionTo").mockReturnValue(invalidTransition);

    await expect(service.confirmEmail(token)).rejects.toThrow("ACCESS_VERIFICATION_PERSISTENCE_FAILED");
    transition.mockRestore();

    expect(await requests.findById(row.id)).toMatchObject({ status: "PENDING_EMAIL_VERIFICATION" });
    expect(await findSlot(row.id)).toMatchObject({ usedAt: null });
    expect((await requests.findEvents(row.id)).filter((event) => event.toStatus === "PENDING_REVIEW")).toHaveLength(0);
    expect(await service.confirmEmail(token)).toBe(true);
  });

  it("rollback de evento de emissão não envia segredo nem deixa slot parcial", async () => {
    const row = await createRequest();
    const eventFailure = jest.spyOn(AccessRequestRepository.prototype, "createVerificationEvent").mockRejectedValue(new Error("DB detail"));

    await expect(service.issueVerification(row.id)).rejects.toThrow("ACCESS_VERIFICATION_PERSISTENCE_FAILED");
    eventFailure.mockRestore();
    expect(sender.messages).toHaveLength(0);
    expect(await prisma.emailVerificationToken.count()).toBe(0);
    expect((await requests.findEvents(row.id)).map((event) => event.eventType)).toEqual(["STATUS_TRANSITION"]);
  });

  it("expõe código genérico quando o cleanup da falha de entrega também falha", async () => {
    const row = await createRequest();
    service = new EmailVerificationService(requests, new FakeEmailSender({ fail: true }), PUBLIC_WEB_URL, () => new Date(now));
    const cleanupFailure = jest.spyOn(EmailVerificationTokenRepository.prototype, "revokeIfAvailable").mockRejectedValue(new Error("database details"));

    await expect(service.issueVerification(row.id)).rejects.toThrow("ACCESS_VERIFICATION_CLEANUP_FAILED");
    cleanupFailure.mockRestore();
    expect((await findSlot(row.id))?.revokedAt).toBeNull();
    expect(await requests.findById(row.id)).toMatchObject({ status: "PENDING_EMAIL_VERIFICATION" });
  });

  it("não registra segredo bruto em logs durante falha de entrega e erro persistido é genérico", async () => {
    const row = await createRequest();
    const attemptedMessages: EmailMessage[] = [];
    const failureSender = new FakeEmailSender({ fail: true, beforeSend: (message) => { attemptedMessages.push(message); } });
    service = new EmailVerificationService(requests, failureSender, PUBLIC_WEB_URL, () => new Date(now));
    const logs = [
      jest.spyOn(console, "log"),
      jest.spyOn(console, "info"),
      jest.spyOn(console, "warn"),
      jest.spyOn(console, "error"),
    ];

    expect(await service.issueVerification(row.id)).toBe("DELIVERY_FAILED");
    const serializedLogs = JSON.stringify(logs.map((log) => log.mock.calls));
    for (const message of attemptedMessages) expect(serializedLogs).not.toContain(tokenFrom(message));
    expect(serializedLogs).not.toContain("DB detail");
  });
});
