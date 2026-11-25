/**
 * Exercita ativação de conta, consumo único e atomicidade no MySQL isolado.
 * Confirma que convite, User, estado e auditoria formam uma única transação.
 * Consumido pelo Jest focal da Etapa 5 da Issue #51.
 */
import { prisma } from "../../src/database/prisma.database";
import { AccessRequestEntity } from "../../src/models/access-request.model";
import { AccessInvitationRepository } from "../../src/repositories/access-invitation.repository";
import { AccessRequestRepository } from "../../src/repositories/access-request.repository";
import { UserRepository } from "../../src/repositories/user.repository";
import { AccountActivationService } from "../../src/services/account-activation.service";
import { comparePassword } from "../../src/utils/hash.util";
import { generateAccessToken, hashAccessToken } from "../../src/utils/access-token.util";
import { cleanDatabase } from "../setup";
import { createAccountActivationFixture } from "../fixtures/account-activation.fixture";
import { seedUser } from "../fixtures/users.fixture";

const requests = new AccessRequestRepository(prisma);
const invitations = new AccessInvitationRepository(prisma);
const INITIAL_TIME = new Date("2026-11-17T12:00:00.000Z");
const PASSWORD = "New-activation-password-51";

let now: Date;
let service: AccountActivationService;

beforeEach(async () => {
  await cleanDatabase();
  now = new Date(INITIAL_TIME);
  service = new AccountActivationService(requests, invitations, undefined, () => new Date(now));
});

afterEach(() => {
  jest.restoreAllMocks();
});

async function expectActivationRowsUnchanged(fixture: Awaited<ReturnType<typeof createAccountActivationFixture>>) {
  const [request, invitation, users, audit, events] = await Promise.all([
    prisma.accessRequest.findUnique({ where: { id: fixture.request.id } }),
    prisma.accessInvitation.findUnique({ where: { accessRequestId: fixture.request.id } }),
    prisma.user.findMany({ orderBy: { email: "asc" } }),
    prisma.auditLog.findMany({ where: { entityId: fixture.request.id }, orderBy: { action: "asc" } }),
    prisma.accessRequestEvent.findMany({ where: { accessRequestId: fixture.request.id }, orderBy: { createdAt: "asc" } }),
  ]);
  expect(request).toEqual(fixture.request);
  expect(invitation).toEqual(fixture.invitation);
  expect(users).toHaveLength(fixture.reviewerId ? 1 : 0);
  expect(audit).toEqual([]);
  expect(events).toHaveLength(fixture.request.status === "APPROVED" ? 3 : 2);
}

async function seedInvitationForIneligibleRequest(accessRequestId: string): Promise<string> {
  // Cria um token estruturalmente válido em estado incompatível de propósito:
  // o service precisa negar também se uma escrita fora do fluxo semear o slot.
  const generated = generateAccessToken();
  await prisma.accessInvitation.create({
    data: {
      accessRequestId,
      tokenHash: generated.tokenHash,
      issuedAt: now,
      createdAt: now,
      expiresAt: new Date(now.getTime() + 24 * 60 * 60_000),
    },
  });
  return generated.token;
}

describe("AccountActivationService — leitura e validação do convite", () => {
  it("valida convite sem escrever, hashear senha ou devolver PII", async () => {
    const fixture = await createAccountActivationFixture();
    const passwordHasher = jest.fn(async () => "hash que não deve ser usado");
    service = new AccountActivationService(requests, invitations, passwordHasher, () => new Date(now));
    const before = {
      request: await prisma.accessRequest.findUnique({ where: { id: fixture.request.id } }),
      invitation: await prisma.accessInvitation.findUnique({ where: { accessRequestId: fixture.request.id } }),
      events: await prisma.accessRequestEvent.findMany({ where: { accessRequestId: fixture.request.id } }),
      audits: await prisma.auditLog.findMany(),
      users: await prisma.user.count(),
    };

    await expect(service.validate(fixture.token!)).resolves.toEqual({ valid: true });

    expect(passwordHasher).not.toHaveBeenCalled();
    expect(await prisma.accessRequest.findUnique({ where: { id: fixture.request.id } })).toEqual(before.request);
    expect(await prisma.accessInvitation.findUnique({ where: { accessRequestId: fixture.request.id } })).toEqual(before.invitation);
    expect(await prisma.accessRequestEvent.findMany({ where: { accessRequestId: fixture.request.id } })).toEqual(before.events);
    expect(await prisma.auditLog.findMany()).toEqual(before.audits);
    expect(await prisma.user.count()).toBe(before.users);
    expect(JSON.stringify({ valid: true })).not.toContain(fixture.request.email);
    expect(JSON.stringify({ valid: true })).not.toContain(fixture.request.name);
  });

  it("retorna inválido para token inexistente e formas não canônicas", async () => {
    const unknown = generateAccessToken().token;
    for (const token of [unknown, "", "abc", "a".repeat(42), `${"a".repeat(42)}!`]) {
      await expect(service.validate(token)).resolves.toEqual({ valid: false });
    }
  });

  it("neutraliza falha de leitura na validação sem propagar detalhe de persistência", async () => {
    const fixture = await createAccountActivationFixture();
    jest.spyOn(AccessInvitationRepository.prototype, "findByHash")
      .mockRejectedValue(new Error("private database diagnostic"));

    await expect(service.validate(fixture.token!)).rejects.toThrow("ACCOUNT_ACTIVATION_VALIDATION_FAILED");
  });

  it.each([
    ["não verificado", { stage: "PENDING_EMAIL_VERIFICATION" as const }],
    ["aguardando decisão", { stage: "PENDING_REVIEW" as const }],
    ["convite expirado", { invitation: { expiresAt: new Date(INITIAL_TIME.getTime() + 1) } }],
    ["convite usado", { invitation: { usedAt: INITIAL_TIME } }],
    ["convite revogado", { invitation: { revokedAt: INITIAL_TIME } }],
    ["convite emitido no futuro", { invitation: { issuedAt: new Date(INITIAL_TIME.getTime() + 1) } }],
  ])("retorna inválido para pedido ou convite %s", async (_label, options) => {
    const fixture = await createAccountActivationFixture(options);
    const token = _label === "não verificado" || _label === "aguardando decisão"
      ? await seedInvitationForIneligibleRequest(fixture.request.id)
      : fixture.token!;
    if (_label === "convite expirado") now = new Date(INITIAL_TIME.getTime() + 1);
    await expect(service.validate(token)).resolves.toEqual({ valid: false });
    await expect(service.activate(token, PASSWORD)).rejects.toThrow("INVALID_ACTIVATION_TOKEN");
    expect(await prisma.user.count({ where: { email: fixture.request.email } })).toBe(0);
  });

  it("retorna inválido no limite de expiração do pedido e quando já existe User equivalente na collation MySQL", async () => {
    const expired = await createAccountActivationFixture({ email: "expired-approval@empresa.local" });
    const requestDeadline = new Date(now.getTime() + 1);
    await prisma.accessRequest.update({
      where: { id: expired.request.id },
      data: { expiresAt: requestDeadline },
    });
    await prisma.accessInvitation.update({
      where: { accessRequestId: expired.request.id },
      data: { expiresAt: requestDeadline },
    });
    now = requestDeadline;
    await expect(service.validate(expired.token!)).resolves.toEqual({ valid: false });

    const conflict = await createAccountActivationFixture({ email: "pessoa@empresa.local" });
    await seedUser({
      name: "Conta criada em outro fluxo",
      email: "PÉSSOA@EMPRESA.LOCAL",
      password: "Existing-account-password",
      role: "CLIENT",
    });
    await expect(service.validate(conflict.token!)).resolves.toEqual({ valid: false });
  });

  it("nega convite ligado a pedido REJECTED sem alterar dados ou criar identidade", async () => {
    const fixture = await createAccountActivationFixture({ stage: "PENDING_REVIEW" });
    const token = await seedInvitationForIneligibleRequest(fixture.request.id);
    const reviewer = await seedUser({
      name: "Revisor de rejeição",
      email: "activation-rejected-reviewer@vulnera.local",
      password: "Activation-rejected-reviewer-password",
      role: "ADMIN",
    });
    const rejectedTransition = new AccessRequestEntity(fixture.request).transitionTo(
      "REJECTED",
      { userId: reviewer.id, role: "ADMIN" },
      "Pedido recusado no cenário de ativação",
      now,
    );
    expect(await requests.transitionIfCurrent(fixture.request.id, rejectedTransition)).toBe(true);
    const before = {
      request: await prisma.accessRequest.findUnique({ where: { id: fixture.request.id } }),
      invitation: await prisma.accessInvitation.findUnique({ where: { accessRequestId: fixture.request.id } }),
      events: await prisma.accessRequestEvent.findMany({ where: { accessRequestId: fixture.request.id } }),
      users: await prisma.user.findMany({ orderBy: { email: "asc" } }),
      audits: await prisma.auditLog.findMany(),
      companies: await prisma.company.count(),
      subscriptions: await prisma.subscription.count(),
      refreshTokens: await prisma.refreshToken.findMany(),
    };

    await expect(service.validate(token)).resolves.toEqual({ valid: false });
    await expect(service.activate(token, PASSWORD)).rejects.toThrow("INVALID_ACTIVATION_TOKEN");

    expect({
      request: await prisma.accessRequest.findUnique({ where: { id: fixture.request.id } }),
      invitation: await prisma.accessInvitation.findUnique({ where: { accessRequestId: fixture.request.id } }),
      events: await prisma.accessRequestEvent.findMany({ where: { accessRequestId: fixture.request.id } }),
      users: await prisma.user.findMany({ orderBy: { email: "asc" } }),
      audits: await prisma.auditLog.findMany(),
      companies: await prisma.company.count(),
      subscriptions: await prisma.subscription.count(),
      refreshTokens: await prisma.refreshToken.findMany(),
    }).toEqual(before);
  });

  it("nega convite ligado a pedido EXPIRED sem alterar dados ou criar identidade", async () => {
    const fixture = await createAccountActivationFixture();
    const expiration = fixture.request.expiresAt;
    const expiredTransition = new AccessRequestEntity(fixture.request).transitionTo(
      "EXPIRED",
      undefined,
      undefined,
      expiration,
    );
    expect(await requests.transitionIfCurrent(fixture.request.id, expiredTransition)).toBe(true);
    now = expiration;
    const before = {
      request: await prisma.accessRequest.findUnique({ where: { id: fixture.request.id } }),
      invitation: await prisma.accessInvitation.findUnique({ where: { accessRequestId: fixture.request.id } }),
      events: await prisma.accessRequestEvent.findMany({ where: { accessRequestId: fixture.request.id } }),
      users: await prisma.user.findMany({ orderBy: { email: "asc" } }),
      audits: await prisma.auditLog.findMany(),
      companies: await prisma.company.count(),
      subscriptions: await prisma.subscription.count(),
      refreshTokens: await prisma.refreshToken.findMany(),
    };

    await expect(service.validate(fixture.token!)).resolves.toEqual({ valid: false });
    await expect(service.activate(fixture.token!, PASSWORD)).rejects.toThrow("INVALID_ACTIVATION_TOKEN");

    expect({
      request: await prisma.accessRequest.findUnique({ where: { id: fixture.request.id } }),
      invitation: await prisma.accessInvitation.findUnique({ where: { accessRequestId: fixture.request.id } }),
      events: await prisma.accessRequestEvent.findMany({ where: { accessRequestId: fixture.request.id } }),
      users: await prisma.user.findMany({ orderBy: { email: "asc" } }),
      audits: await prisma.auditLog.findMany(),
      companies: await prisma.company.count(),
      subscriptions: await prisma.subscription.count(),
      refreshTokens: await prisma.refreshToken.findMany(),
    }).toEqual(before);
  });
});

describe("AccountActivationService — consumo e criação atômicos", () => {
  it("cria User CLIENT sem vínculo, consome convite, transiciona e audita sem sessão ou empresa", async () => {
    const fixture = await createAccountActivationFixture({
      email: "Pessoa.Aprovada@Empresa.Local",
      name: "Pessoa aprovada",
    });

    await expect(service.activate(fixture.token!, PASSWORD)).resolves.toBeUndefined();

    const [user, activated, invitation, events, audits] = await Promise.all([
      prisma.user.findUnique({ where: { email: fixture.request.email } }),
      prisma.accessRequest.findUnique({ where: { id: fixture.request.id } }),
      prisma.accessInvitation.findUnique({ where: { accessRequestId: fixture.request.id } }),
      prisma.accessRequestEvent.findMany({ where: { accessRequestId: fixture.request.id }, orderBy: { createdAt: "asc" } }),
      prisma.auditLog.findMany({ where: { entityType: "AccessRequest", entityId: fixture.request.id } }),
    ]);

    expect(user).toMatchObject({
      name: fixture.request.name,
      email: fixture.request.email,
      role: "CLIENT",
      companyId: null,
      companyRole: null,
      legacyOnboardingAllowed: true,
    });
    expect(user!.password).not.toBe(PASSWORD);
    await expect(comparePassword(PASSWORD, user!.password)).resolves.toBe(true);
    expect(activated).toMatchObject({ status: "ACTIVATED", activeEmail: null, emailVerifiedAt: fixture.request.emailVerifiedAt });
    expect(invitation).toMatchObject({ usedAt: now, revokedAt: null, tokenHash: hashAccessToken(fixture.token!) });
    expect(events.at(-1)).toMatchObject({ fromStatus: "APPROVED", toStatus: "ACTIVATED", actorId: null, createdAt: now });
    expect(audits.map((row) => row.action).sort()).toEqual(["ACCESS_INVITATION_USED", "ACCOUNT_ACTIVATED"]);
    expect(audits.every((row) => row.actorId === user!.id && row.companyId === null && row.diffJson === null)).toBe(true);
    expect(await prisma.user.count({ where: { role: "CLIENT" } })).toBe(1);
    expect(await prisma.company.count()).toBe(0);
    expect(await prisma.subscription.count()).toBe(0);
    expect(await prisma.refreshToken.count()).toBe(0);

    await expect(service.activate(fixture.token!, PASSWORD)).rejects.toThrow("INVALID_ACTIVATION_TOKEN");
    expect(await prisma.user.count({ where: { role: "CLIENT" } })).toBe(1);
  });

  it("somente uma ativação simultânea cria User e consome o convite", async () => {
    const fixture = await createAccountActivationFixture();
    const results = await Promise.allSettled([
      service.activate(fixture.token!, PASSWORD),
      service.activate(fixture.token!, PASSWORD),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(await prisma.user.count({ where: { email: fixture.request.email } })).toBe(1);
    expect(await prisma.accessRequest.findUnique({ where: { id: fixture.request.id } })).toMatchObject({ status: "ACTIVATED", activeEmail: null });
    expect(await prisma.accessInvitation.count({ where: { accessRequestId: fixture.request.id, usedAt: now } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { entityId: fixture.request.id } })).toBe(2);
  });

  it("não ativa quando a comparação de e-mail do User colide por caixa ou acento no MySQL", async () => {
    const fixture = await createAccountActivationFixture({ email: "cafe@empresa.local" });
    await seedUser({
      name: "Conta equivalente preexistente",
      email: "CAFÉ@EMPRESA.LOCAL",
      password: "Existing-account-password",
      role: "CLIENT",
    });

    await expect(service.activate(fixture.token!, PASSWORD)).rejects.toThrow("INVALID_ACTIVATION_TOKEN");

    expect(await prisma.user.count({ where: { email: fixture.request.email } })).toBe(1);
    expect(await prisma.accessRequest.findUnique({ where: { id: fixture.request.id } })).toEqual(fixture.request);
    expect(await prisma.accessInvitation.findUnique({ where: { accessRequestId: fixture.request.id } })).toEqual(fixture.invitation);
    expect(await prisma.auditLog.count({ where: { entityId: fixture.request.id } })).toBe(0);
  });

  it("reverte consumo e todos os registros se a escrita do token falhar após o UPDATE", async () => {
    const fixture = await createAccountActivationFixture();
    const consume = AccessInvitationRepository.prototype.consumeIfAvailable;
    const injected = jest.spyOn(AccessInvitationRepository.prototype, "consumeIfAvailable")
      .mockImplementation(async function (this: AccessInvitationRepository, ...args: Parameters<typeof consume>) {
        const consumed = await consume.apply(this, args);
        if (consumed) throw new Error("INJECTED_AFTER_CONSUME");
        return consumed;
      });

    await expect(service.activate(fixture.token!, PASSWORD)).rejects.toThrow();

    expect(injected).toHaveBeenCalledTimes(1);
    await expectActivationRowsUnchanged(fixture);
  });

  it("reverte o consumo e o User se a criação do User falhar depois da escrita real", async () => {
    const fixture = await createAccountActivationFixture();
    const create = UserRepository.prototype.create;
    const injected = jest.spyOn(UserRepository.prototype, "create")
      .mockImplementation(async function (this: UserRepository, ...args: Parameters<typeof create>) {
        const created = await create.apply(this, args);
        throw new Error(`INJECTED_AFTER_USER:${created.id}`);
      });

    await expect(service.activate(fixture.token!, PASSWORD)).rejects.toThrow("ACCOUNT_ACTIVATION_FAILED");

    expect(injected).toHaveBeenCalledTimes(1);
    await expectActivationRowsUnchanged(fixture);
  });

  it("reverte pedido, convite e User se a auditoria falhar depois de gravar os eventos", async () => {
    const fixture = await createAccountActivationFixture();
    const createAudit = AccessRequestRepository.prototype.createActivationAuditEvent;
    const injected = jest.spyOn(AccessRequestRepository.prototype, "createActivationAuditEvent")
      .mockImplementation(async function (this: AccessRequestRepository, ...args: Parameters<typeof createAudit>) {
        await createAudit.apply(this, args);
        throw new Error("INJECTED_AFTER_AUDIT");
      });

    await expect(service.activate(fixture.token!, PASSWORD)).rejects.toThrow();

    expect(injected).toHaveBeenCalledTimes(1);
    await expectActivationRowsUnchanged(fixture);
  });

  it("reverte User, consumo e auditoria se a transição falhar após suas escritas reais", async () => {
    const fixture = await createAccountActivationFixture();
    const transition = AccessRequestRepository.prototype.transitionIfCurrent;
    const injected = jest.spyOn(AccessRequestRepository.prototype, "transitionIfCurrent")
      .mockImplementation(async function (this: AccessRequestRepository, ...args: Parameters<typeof transition>) {
        const changed = await transition.apply(this, args);
        if (changed) throw new Error("INJECTED_AFTER_TRANSITION");
        return changed;
      });

    await expect(service.activate(fixture.token!, PASSWORD)).rejects.toThrow();

    expect(injected).toHaveBeenCalledTimes(1);
    await expectActivationRowsUnchanged(fixture);
  });

  it("reverte a ativação quando outra escrita vence a unicidade User.email entre precheck e INSERT", async () => {
    const fixture = await createAccountActivationFixture({ email: "unique-race@empresa.local" });
    const create = UserRepository.prototype.create;
    const injected = jest.spyOn(UserRepository.prototype, "create")
      .mockImplementation(async function (this: UserRepository, ...args: Parameters<typeof create>) {
        if (args[0].email === fixture.request.email) {
          await seedUser({
            name: "Conta concorrente",
            email: fixture.request.email.toUpperCase(),
            password: "Concurrent-account-password",
            role: "CLIENT",
          });
        }
        return create.apply(this, args);
      });

    await expect(service.activate(fixture.token!, PASSWORD)).rejects.toThrow("INVALID_ACTIVATION_TOKEN");

    expect(injected).toHaveBeenCalledTimes(1);
    expect(await prisma.user.count({ where: { email: fixture.request.email } })).toBe(1);
    expect(await prisma.accessRequest.findUnique({ where: { id: fixture.request.id } })).toEqual(fixture.request);
    expect(await prisma.accessInvitation.findUnique({ where: { accessRequestId: fixture.request.id } })).toEqual(fixture.invitation);
    expect(await prisma.auditLog.count({ where: { entityId: fixture.request.id } })).toBe(0);
  });

  it("reconfere os prazos depois dos locks quando o hasher cruza a expiração", async () => {
    const fixture = await createAccountActivationFixture();
    const deadline = new Date(now.getTime() + 1);
    await prisma.accessRequest.update({ where: { id: fixture.request.id }, data: { expiresAt: deadline } });
    await prisma.accessInvitation.update({ where: { accessRequestId: fixture.request.id }, data: { expiresAt: deadline } });
    let requestLocked = false;
    let invitationLocked = false;
    const lockRequest = AccessRequestRepository.prototype.findByIdForUpdate;
    const lockInvitation = AccessInvitationRepository.prototype.findByAccessRequestIdForUpdate;
    jest.spyOn(AccessRequestRepository.prototype, "findByIdForUpdate")
      .mockImplementation(async function (this: AccessRequestRepository, ...args: Parameters<typeof lockRequest>) {
        const result = await lockRequest.apply(this, args);
        requestLocked = true;
        return result;
      });
    jest.spyOn(AccessInvitationRepository.prototype, "findByAccessRequestIdForUpdate")
      .mockImplementation(async function (this: AccessInvitationRepository, ...args: Parameters<typeof lockInvitation>) {
        const result = await lockInvitation.apply(this, args);
        invitationLocked = true;
        return result;
      });
    service = new AccountActivationService(
      requests,
      invitations,
      async () => {
        now = deadline;
        return "controlled-hash-for-expiration-test";
      },
      () => requestLocked && invitationLocked ? new Date(now) : new Date(INITIAL_TIME),
    );

    await expect(service.activate(fixture.token!, PASSWORD)).rejects.toThrow("INVALID_ACTIVATION_TOKEN");

    expect(requestLocked).toBe(true);
    expect(invitationLocked).toBe(true);
    expect(await prisma.accessRequest.findUnique({ where: { id: fixture.request.id } }))
      .toMatchObject({ status: "APPROVED", activeEmail: fixture.request.email });
    expect(await prisma.accessInvitation.findUnique({ where: { accessRequestId: fixture.request.id } }))
      .toMatchObject({ usedAt: null, revokedAt: null });
    expect(await prisma.user.count({ where: { email: fixture.request.email } })).toBe(0);
    expect(await prisma.auditLog.count({ where: { entityId: fixture.request.id } })).toBe(0);
  });

  it.each(["reemissão", "revogação"] as const)("serializa ativação contra %s e invalida o token velho", async (mutation) => {
    const fixture = await createAccountActivationFixture();
    const originalHash = fixture.invitation!.tokenHash;
    const findByHash = AccessInvitationRepository.prototype.findByHash;
    let signalRead!: () => void;
    let resumeRead!: () => void;
    const readComplete = new Promise<void>((resolve) => { signalRead = resolve; });
    const resume = new Promise<void>((resolve) => { resumeRead = resolve; });
    const lookup = jest.spyOn(AccessInvitationRepository.prototype, "findByHash")
      .mockImplementation(async function (this: AccessInvitationRepository, ...args: Parameters<typeof findByHash>) {
        const found = await findByHash.apply(this, args);
        if (args[0] === originalHash) {
          signalRead();
          await resume;
        }
        return found;
      });
    const activation = service.activate(fixture.token!, PASSWORD);
    await readComplete;

    let replacementToken: string | null = null;
    if (mutation === "reemissão") {
      const replacement = generateAccessToken();
      replacementToken = replacement.token;
      expect(await invitations.rotateIfAvailable({
        accessRequestId: fixture.request.id,
        expectedTokenHash: originalHash,
        expectedRevokedAt: null,
        tokenHash: replacement.tokenHash,
        expiresAt: new Date(now.getTime() + 48 * 60 * 60_000),
      }, now)).toBe(true);
    } else {
      expect(await invitations.revokeIfAvailable({
        accessRequestId: fixture.request.id,
        expectedTokenHash: originalHash,
      }, now)).toBe(true);
    }
    resumeRead();

    await expect(activation).rejects.toThrow("INVALID_ACTIVATION_TOKEN");
    expect(lookup).toHaveBeenCalled();
    await expect(service.validate(fixture.token!)).resolves.toEqual({ valid: false });
    if (replacementToken) {
      await expect(service.validate(replacementToken)).resolves.toEqual({ valid: true });
    }
    expect(await prisma.user.count({ where: { email: fixture.request.email } })).toBe(0);
    expect(await prisma.accessRequest.findUnique({ where: { id: fixture.request.id } })).toMatchObject({ status: "APPROVED" });
  });
});
