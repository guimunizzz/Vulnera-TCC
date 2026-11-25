/**
 * Valida a orquestração pública de pedidos contra MySQL isolado.
 * Protege reserva, envio neutro e confirmação; consumido pelo Jest de integração.
 */
import { prisma } from "../../src/database/prisma.database";
import type { CreateAccessRequestDTO } from "../../src/models/access-request.model";
import type { EmailMessage } from "../../src/models/email.model";
import { AccessRequestRepository } from "../../src/repositories/access-request.repository";
import { AccessRequestService } from "../../src/services/access-request.service";
import { EmailVerificationService } from "../../src/services/email-verification.service";
import { hashAccessToken } from "../../src/utils/access-token.util";
import { FakeEmailSender } from "../fixtures/fake-email-sender";
import { seedUser } from "../fixtures/users.fixture";
import { cleanDatabase } from "../setup";

const requests = new AccessRequestRepository(prisma);
const PUBLIC_WEB_URL = "https://app.vulnera.example";
const COOLDOWN_MS = 60_000;
const DAY_MS = 86_400_000;
const PASSWORD = "Access-request-public-test-password";
const INPUT: CreateAccessRequestDTO = {
  name: "Pessoa solicitante",
  email: "public-access@empresa.local",
  companyName: "Empresa declarada",
  phone: "11999990000",
};

let now: Date;
let sender: FakeEmailSender;
let verification: EmailVerificationService;
let service: AccessRequestService;

function configureService(nextSender = new FakeEmailSender()): void {
  sender = nextSender;
  verification = new EmailVerificationService(requests, sender, PUBLIC_WEB_URL, () => new Date(now));
  service = new AccessRequestService(requests, verification, {
    clock: () => new Date(now),
    cooldownMs: COOLDOWN_MS,
  });
}

function tokenFrom(message: EmailMessage): string {
  const match = message.text.match(/#token=([A-Za-z0-9_-]{43})/u);
  expect(match).not.toBeNull();
  return match![1];
}

async function activeRequest(email = INPUT.email) {
  return prisma.accessRequest.findUnique({ where: { activeEmail: email.trim().toLowerCase() } });
}

beforeEach(async () => {
  await cleanDatabase();
  now = new Date("2026-10-20T12:00:00.000Z");
  configureService();
});

describe("AccessRequestService — solicitação pública", () => {
  it("cria pedido e verificação, reutiliza duplicata sem alterar dados pessoais", async () => {
    await service.request(INPUT);
    await service.request({
      ...INPUT,
      name: "Nome enviado na duplicata",
      email: " PUBLIC-ACCESS@EMPRESA.LOCAL ",
      companyName: "Empresa enviada na duplicata",
      phone: "11888887777",
    });

    const row = await activeRequest();
    expect(row).toMatchObject({ ...INPUT, activeEmail: INPUT.email, status: "PENDING_EMAIL_VERIFICATION" });
    expect(sender.messages).toHaveLength(1);
    expect(await prisma.accessRequest.count()).toBe(1);
    expect(await prisma.accessRequestEvent.count()).toBe(2);
    expect(await prisma.emailVerificationToken.count()).toBe(1);
    expect(await prisma.emailVerificationToken.findUnique({ where: { accessRequestId: row!.id } }))
      .toMatchObject({ tokenHash: hashAccessToken(tokenFrom(sender.messages[0])), usedAt: null, revokedAt: null });
    expect(await Promise.all([
      prisma.user.count(), prisma.company.count(), prisma.subscription.count(),
      prisma.refreshToken.count(), prisma.auditLog.count(),
    ])).toEqual([0, 0, 0, 0, 0]);
  });

  it("serializa pedidos públicos concorrentes equivalentes e envia uma mensagem", async () => {
    await Promise.all([
      service.request(INPUT),
      service.request({ ...INPUT, email: " PUBLIC-ACCESS@EMPRESA.LOCAL " }),
      service.request({ ...INPUT, email: "Public-Access@empresa.local" }),
    ]);

    expect(await prisma.accessRequest.count()).toBe(1);
    expect(await prisma.accessRequestEvent.count()).toBe(2);
    expect(await prisma.emailVerificationToken.count()).toBe(1);
    expect(sender.messages).toHaveLength(1);
    expect((await activeRequest())?.name).toBe(INPUT.name);
  });

  it("persiste o cooldown entre aliases e serializa reenvios simultâneos", async () => {
    await service.request(INPUT);
    const firstTokenSlot = await prisma.emailVerificationToken.findFirst();
    expect(firstTokenSlot).not.toBeNull();
    const firstHash = firstTokenSlot!.tokenHash;
    // Um novo objeto de serviço não pode zerar a janela persistida.
    configureService(sender);

    await Promise.all([
      service.resend("PUBLIC-ACCESS@EMPRESA.LOCAL"),
      service.resend(" public-access@empresa.local "),
      service.request({ ...INPUT, email: "Public-Access@empresa.local" }),
    ]);
    expect(sender.messages).toHaveLength(1);
    expect((await prisma.emailVerificationToken.findFirst())?.tokenHash).toBe(firstHash);

    now = new Date(now.getTime() + COOLDOWN_MS + 1);
    await Promise.all([
      service.resend("PUBLIC-ACCESS@EMPRESA.LOCAL"),
      service.resend(" public-access@empresa.local "),
      service.request(INPUT),
    ]);
    expect(sender.messages).toHaveLength(2);
    expect((await prisma.emailVerificationToken.findFirst())?.tokenHash).not.toBe(firstHash);
  });

  it.each([
    ["Pessoa@empresa.local", "pessoa@empresa.local"],
    ["pessoa@empresa.local", "péssoa@empresa.local"],
    ["strasse@empresa.local", "straße@empresa.local"],
    ["café@empresa.local", "cafe\u0301@empresa.local"],
  ])("consulta User pela collation do MySQL e não envia para conta existente (%s / %s)", async (stored, submitted) => {
    await seedUser({ name: "Conta antiga", email: stored, password: PASSWORD, role: "CLIENT" });

    await service.request({ ...INPUT, email: submitted });
    await service.resend(submitted);

    expect(await prisma.user.count()).toBe(1);
    expect(await prisma.accessRequest.count()).toBe(0);
    expect(await prisma.emailVerificationToken.count()).toBe(0);
    expect(sender.messages).toHaveLength(0);
  });

  it("expira e libera a reserva vencida antes de criar uma nova, preservando histórico", async () => {
    const createdAt = new Date(now.getTime() - 8 * DAY_MS);
    const old = await requests.createIfEmailAvailable(INPUT, createdAt);
    expect(old).not.toBeNull();

    await service.request({ ...INPUT, name: "Nome atualizado", companyName: "Nova empresa", phone: null });

    const history = await prisma.accessRequest.findMany({ orderBy: { createdAt: "asc" } });
    expect(history).toHaveLength(2);
    expect(history[0]).toMatchObject({ id: old!.id, name: INPUT.name, status: "EXPIRED", activeEmail: null });
    expect(history[1]).toMatchObject({
      name: "Nome atualizado", companyName: "Nova empresa", phone: null,
      email: INPUT.email, status: "PENDING_EMAIL_VERIFICATION", activeEmail: INPUT.email,
    });
    expect(await prisma.accessRequestEvent.findMany({
      where: { accessRequestId: old!.id }, orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    }))
      .toMatchObject([
        { fromStatus: null, toStatus: "PENDING_EMAIL_VERIFICATION" },
        { fromStatus: "PENDING_EMAIL_VERIFICATION", toStatus: "EXPIRED" },
      ]);
    expect(sender.messages).toHaveLength(1);
  });

  it("substitui reserva vencida uma vez sob concorrência e revoga o token anterior", async () => {
    await service.request(INPUT);
    const old = await activeRequest();
    const oldToken = tokenFrom(sender.messages[0]);
    now = new Date(now.getTime() + 8 * DAY_MS);

    await Promise.all([
      service.request(INPUT),
      service.request({ ...INPUT, email: " PUBLIC-ACCESS@EMPRESA.LOCAL " }),
    ]);

    const history = await prisma.accessRequest.findMany({ orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
    const oldSlot = await prisma.emailVerificationToken.findUnique({ where: { accessRequestId: old!.id } });
    expect(history).toHaveLength(2);
    expect(history[0]).toMatchObject({ id: old!.id, status: "EXPIRED", activeEmail: null });
    expect(history[1]).toMatchObject({ status: "PENDING_EMAIL_VERIFICATION", activeEmail: INPUT.email });
    expect(await prisma.accessRequest.count({ where: { activeEmail: { not: null } } })).toBe(1);
    expect(await prisma.emailVerificationToken.count()).toBe(2);
    expect(oldSlot?.revokedAt).toEqual(now);
    expect(await service.confirmEmail(oldToken)).toBe(false);
    expect(sender.messages).toHaveLength(2);
  });

  it("reverte expiração e liberação se a criação da tentativa seguinte falhar", async () => {
    const createdAt = new Date(now.getTime() - 8 * DAY_MS);
    const old = await requests.createIfEmailAvailable(INPUT, createdAt);
    expect(old).not.toBeNull();

    await expect(service.request({ ...INPUT, name: "x".repeat(10_000) }))
      .rejects.toThrow("ACCESS_REQUEST_PERSISTENCE_FAILED");

    expect(await prisma.accessRequest.findUnique({ where: { id: old!.id } })).toEqual(old);
    expect(await prisma.accessRequest.count()).toBe(1);
    expect(await prisma.accessRequestEvent.count()).toBe(1);
    expect(sender.messages).toHaveLength(0);
  });

  it("recupera verificação ausente, expirada, revogada e com falha de SMTP", async () => {
    const missing = await requests.createIfEmailAvailable({ ...INPUT, email: "missing@empresa.local" }, now);
    expect(missing).not.toBeNull();
    await service.request({ ...INPUT, email: "missing@empresa.local" });
    expect(sender.messages).toHaveLength(1);

    const firstToken = tokenFrom(sender.messages[0]);
    now = new Date(now.getTime() + 60 * 60_000 + 1);
    await service.request({ ...INPUT, email: "missing@empresa.local" });
    expect(sender.messages).toHaveLength(2);
    const rotated = await prisma.emailVerificationToken.findUnique({ where: { accessRequestId: missing!.id } });
    expect(rotated?.tokenHash).not.toBe(hashAccessToken(firstToken));

    await prisma.emailVerificationToken.update({ where: { id: rotated!.id }, data: { revokedAt: now } });
    now = new Date(now.getTime() + COOLDOWN_MS + 1);
    await service.request({ ...INPUT, email: "missing@empresa.local" });
    expect(sender.messages).toHaveLength(3);

    const failedEmail = "smtp-failure@empresa.local";
    configureService(new FakeEmailSender({ fail: true }));
    await service.request({ ...INPUT, email: failedEmail });
    const failedRequest = await activeRequest(failedEmail);
    expect(await prisma.emailVerificationToken.findUnique({ where: { accessRequestId: failedRequest!.id } }))
      .toMatchObject({ revokedAt: now });
    expect((await prisma.accessRequestEvent.findMany({ where: { accessRequestId: failedRequest!.id } }))
      .map(event => event.eventType)).toContain("VERIFICATION_DELIVERY_FAILED");

    now = new Date(now.getTime() + COOLDOWN_MS + 1);
    configureService();
    await service.resend(failedEmail);
    expect(sender.messages).toHaveLength(1);
    expect((await prisma.emailVerificationToken.findUnique({ where: { accessRequestId: failedRequest!.id } }))?.revokedAt)
      .toBeNull();
  });

  it("confirma token válido e não revela token inválido", async () => {
    await service.request(INPUT);
    const token = tokenFrom(sender.messages[0]);

    expect(await service.confirmEmail("not-a-token")).toBe(false);
    expect(await service.confirmEmail(token)).toBe(true);
    expect(await service.confirmEmail(token)).toBe(false);
    expect((await activeRequest())?.status).toBe("PENDING_REVIEW");
    expect((await prisma.user.count())).toBe(0);
  });
});
