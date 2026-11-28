/**
 * Confirma a adesão comercial ponta a ponta e a saída segura de snapshots obsoletos.
 * Existe para proteger criação atômica de Company/Subscription e a compatibilidade legada;
 * consumido pelo Jest de integração contra o MySQL descartável.
 */
import { prisma } from "../../src/database/prisma.database";
import { AccessInvitationRepository } from "../../src/repositories/access-invitation.repository";
import { AccessRequestRepository } from "../../src/repositories/access-request.repository";
import { AdminAccessRequestQueryRepository } from "../../src/repositories/admin-access-request.repository";
import { UserRepository } from "../../src/repositories/user.repository";
import { AccessInvitationService } from "../../src/services/access-invitation.service";
import { AccessRequestService } from "../../src/services/access-request.service";
import { AccessRequestAdminAuthorizationService } from "../../src/services/access-request-admin-authorization.service";
import { AccountActivationService } from "../../src/services/account-activation.service";
import { AdminAccessRequestDecisionService } from "../../src/services/admin-access-request-decision.service";
import { AdminAccessRequestQueryService } from "../../src/services/admin-access-request-query.service";
import { EmailVerificationService } from "../../src/services/email-verification.service";
import { FakeEmailSender } from "../fixtures/fake-email-sender";
import { seedPlan } from "../fixtures/plans.fixture";
import { seedUser } from "../fixtures/users.fixture";
import { cleanDatabase } from "../setup";

const PUBLIC_WEB_URL = "https://app.vulnera.example";
const PASSWORD = "Integrated-enrollment-password";
const INITIAL_TIME = new Date("2026-11-25T12:00:00.000Z");
const CNPJ = "12345678000190";
let now: Date;
let sender: FakeEmailSender;
let requests: AccessRequestRepository;
let accessService: AccessRequestService;
let verification: EmailVerificationService;
let invitationService: AccessInvitationService;
let decisionService: AdminAccessRequestDecisionService;
let queryService: AdminAccessRequestQueryService;
let activationService: AccountActivationService;

function tokenFrom(message: { text: string }): string {
  const match = message.text.match(/#token=([A-Za-z0-9_-]{43})/u);
  expect(match).not.toBeNull();
  return match![1];
}

async function makeAdmin() {
  const user = await seedUser({
    name: "Admin de adesão",
    email: "enrollment-admin@empresa.local",
    password: "Enrollment-admin-password",
    role: "ADMIN",
  });
  return { user, actor: { userId: user.id, role: "ADMIN" as const } };
}

beforeEach(async () => {
  await cleanDatabase();
  now = new Date(INITIAL_TIME);
  sender = new FakeEmailSender();
  requests = new AccessRequestRepository(prisma);
  verification = new EmailVerificationService(requests, sender, PUBLIC_WEB_URL, () => new Date(now));
  accessService = new AccessRequestService(requests, verification, {
    clock: () => new Date(now),
    cooldownMs: 0,
  });
  const users = new UserRepository(prisma);
  const authorization = new AccessRequestAdminAuthorizationService(users);
  invitationService = new AccessInvitationService(
    requests,
    sender,
    PUBLIC_WEB_URL,
    authorization,
    { clock: () => new Date(now), cooldownMs: 0 },
  );
  decisionService = new AdminAccessRequestDecisionService(
    requests,
    invitationService,
    authorization,
    () => new Date(now),
  );
  queryService = new AdminAccessRequestQueryService(
    new AdminAccessRequestQueryRepository(prisma),
    authorization,
  );
  activationService = new AccountActivationService(
    requests,
    new AccessInvitationRepository(prisma),
    undefined,
    () => new Date(now),
  );
});

describe("adesão unificada AccessRequest → aprovação → ativação", () => {
  it("cria CLIENT/OWNER, Company e Subscription ACTIVE no mesmo consumo do convite", async () => {
    const plan = await seedPlan({
      name: "enrollment-plan",
      price: 275.5,
      maxApplications: 7,
      maxProjects: 4,
      includesRemediation: true,
    });
    const input = {
      name: "Pessoa responsável",
      email: "owner-enrollment@empresa.local",
      companyName: "Empresa de adesão",
      companyCnpj: CNPJ,
      planId: plan.id,
    };

    await accessService.request(input);
    const request = await prisma.accessRequest.findUnique({ where: { activeEmail: input.email } });
    expect(request).not.toBeNull();
    const enrollment = await prisma.accessRequestEnrollment.findUnique({
      where: { accessRequestId: request!.id },
    });
    expect(enrollment).toMatchObject({
      companyCnpj: CNPJ,
      planId: plan.id,
      planName: plan.name,
      planMaxApplications: 7,
      planMaxProjects: 4,
      planIncludesRemediation: true,
    });
    expect(enrollment!.planPrice.toFixed(2)).toBe("275.50");

    expect(await verification.confirmEmail(tokenFrom(sender.messages[0]))).toBe(true);
    const admin = await makeAdmin();
    const approved = await decisionService.approve(request!.id, admin.actor);
    expect(approved.request.status).toBe("APPROVED");
    expect(approved.enrollment?.planId).toBe(plan.id);

    const invitationToken = tokenFrom(sender.messages[1]);
    await expect(activationService.validate(invitationToken)).resolves.toEqual({ valid: true });
    await expect(activationService.activate(invitationToken, PASSWORD)).resolves.toBeUndefined();

    const user = await prisma.user.findUnique({ where: { email: input.email } });
    expect(user).toMatchObject({ role: "CLIENT", companyRole: "OWNER", legacyOnboardingAllowed: false });
    expect(user?.companyId).toBeTruthy();
    const company = await prisma.company.findUnique({ where: { id: user!.companyId! } });
    expect(company).toMatchObject({ name: input.companyName, cnpj: CNPJ, planId: plan.id });
    const subscription = await prisma.subscription.findFirst({ where: { companyId: company!.id } });
    expect(subscription).toMatchObject({
      companyId: company!.id,
      planId: plan.id,
      status: "ACTIVE",
      startDate: now,
      approvedBy: admin.user.id,
    });
    expect(await prisma.accessRequest.findUnique({ where: { id: request!.id } }))
      .toMatchObject({ status: "ACTIVATED", activeEmail: null });
    expect(await prisma.refreshToken.count()).toBe(0);
    expect((await prisma.auditLog.findMany({ where: { companyId: company!.id } }))
      .map(event => event.action).sort()).toEqual([
      "ACCESS_INVITATION_USED",
      "ACCOUNT_ACTIVATED",
      "COMPANY_ENROLLED",
      "SUBSCRIPTION_APPROVED",
    ]);
    expect((await prisma.auditLog.findMany({ where: { entityId: request!.id } }))
      .map(event => event.action).sort()).toEqual([
      "ACCESS_INVITATION_ISSUED",
      "ACCESS_INVITATION_USED",
      "ACCOUNT_ACTIVATED",
    ].sort());
  });

  it("mostra snapshot incompatível ao ADMIN e encerra aprovação com motivo, revogando o convite", async () => {
    const plan = await seedPlan({ name: "stale-enrollment-plan", price: 100 });
    const input = {
      name: "Pessoa solicitante",
      email: "stale-enrollment@empresa.local",
      companyName: "Empresa com oferta antiga",
      planId: plan.id,
    };
    await accessService.request(input);
    const request = await prisma.accessRequest.findUnique({ where: { activeEmail: input.email } });
    expect(request).not.toBeNull();
    await verification.confirmEmail(tokenFrom(sender.messages[0]));
    const admin = await makeAdmin();
    await decisionService.approve(request!.id, admin.actor);
    const invitation = await prisma.accessInvitation.findUnique({ where: { accessRequestId: request!.id } });
    expect(invitation).not.toBeNull();

    await prisma.plan.update({ where: { id: plan.id }, data: { price: 125 } });
    await expect(queryService.getById(request!.id, admin.actor)).resolves.toMatchObject({
      status: "APPROVED",
      enrollmentEligibility: "PLAN_CHANGED",
    });
    const invitationToken = tokenFrom(sender.messages[1]);
    await expect(activationService.validate(invitationToken)).resolves.toEqual({ valid: false });
    await expect(activationService.activate(invitationToken, PASSWORD))
      .rejects.toThrow("ACCESS_REQUEST_PLAN_CHANGED");
    await expect(decisionService.reject(request!.id, admin.actor))
      .rejects.toThrow("ACCESS_REQUEST_INVALIDATION_REASON_REQUIRED");
    await expect(decisionService.reject(request!.id, admin.actor, "Oferta alterada após aprovação"))
      .resolves.toMatchObject({ request: { status: "REJECTED" } });

    const [closed, revoked, events] = await Promise.all([
      prisma.accessRequest.findUnique({ where: { id: request!.id } }),
      prisma.accessInvitation.findUnique({ where: { accessRequestId: request!.id } }),
      prisma.accessRequestEvent.findMany({ where: { accessRequestId: request!.id }, orderBy: { createdAt: "asc" } }),
    ]);
    expect(closed).toMatchObject({ status: "REJECTED", activeEmail: null });
    expect(revoked).toMatchObject({ usedAt: null, revokedAt: now });
    expect(events.at(-1)).toMatchObject({
      fromStatus: "APPROVED",
      toStatus: "REJECTED",
      actorId: admin.user.id,
      reason: expect.stringContaining("ENROLLMENT_INVALIDATED: ACCESS_REQUEST_PLAN_CHANGED"),
    });
    expect(await prisma.user.count({ where: { email: input.email } })).toBe(0);
    expect(await prisma.company.count()).toBe(0);
    expect(await prisma.subscription.count()).toBe(0);
  });

  it("reverte convite, Company, User, Subscription e auditoria se o passo final da ativação falhar", async () => {
    const plan = await seedPlan({ name: "rollback-enrollment-plan" });
    const input = {
      name: "Pessoa solicitante",
      email: "rollback-enrollment@empresa.local",
      companyName: "Empresa transacional",
      planId: plan.id,
    };
    await accessService.request(input);
    const request = await prisma.accessRequest.findUnique({ where: { activeEmail: input.email } });
    await verification.confirmEmail(tokenFrom(sender.messages[0]));
    const admin = await makeAdmin();
    await decisionService.approve(request!.id, admin.actor);
    const token = tokenFrom(sender.messages[1]);
    const invitationBefore = await prisma.accessInvitation.findUnique({ where: { accessRequestId: request!.id } });
    const eventsBefore = await prisma.accessRequestEvent.findMany({ where: { accessRequestId: request!.id } });
    const auditBefore = await prisma.auditLog.findMany({ where: { entityId: request!.id } });

    const createAudit = AccessRequestRepository.prototype.createActivationAuditEvent;
    const injected = jest.spyOn(AccessRequestRepository.prototype, "createActivationAuditEvent")
      .mockImplementation(async function (
        this: AccessRequestRepository,
        ...args: Parameters<typeof createAudit>
      ) {
        await createAudit.apply(this, args);
        throw new Error("INJECTED_AFTER_ACTIVATION_AUDIT");
      });
    try {
      await expect(activationService.activate(token, PASSWORD)).rejects.toThrow("ACCOUNT_ACTIVATION_FAILED");
      expect(injected).toHaveBeenCalledTimes(1);
    } finally {
      injected.mockRestore();
    }

    expect(await prisma.accessRequest.findUnique({ where: { id: request!.id } }))
      .toMatchObject({ status: "APPROVED", activeEmail: input.email });
    expect(await prisma.accessInvitation.findUnique({ where: { accessRequestId: request!.id } }))
      .toEqual(invitationBefore);
    expect(await prisma.accessRequestEvent.findMany({ where: { accessRequestId: request!.id } }))
      .toEqual(eventsBefore);
    expect(await prisma.auditLog.findMany({ where: { entityId: request!.id } })).toEqual(auditBefore);
    expect(await prisma.user.count({ where: { email: input.email } })).toBe(0);
    expect(await prisma.company.count()).toBe(0);
    expect(await prisma.subscription.count()).toBe(0);
  });

  it("sinaliza colisão de CNPJ só à equipe ADMIN e permite rejeição ainda em revisão", async () => {
    const plan = await seedPlan({ name: "cnpj-conflict-plan" });
    await prisma.company.create({ data: { name: "Empresa existente", cnpj: CNPJ, planId: plan.id } });
    const input = {
      name: "Pessoa solicitante",
      email: "cnpj-conflict@empresa.local",
      companyName: "Outra empresa declarada",
      companyCnpj: CNPJ,
      planId: plan.id,
    };
    await accessService.request(input);
    const request = await prisma.accessRequest.findUnique({ where: { activeEmail: input.email } });
    await verification.confirmEmail(tokenFrom(sender.messages[0]));
    const admin = await makeAdmin();

    await expect(queryService.getById(request!.id, admin.actor)).resolves.toMatchObject({
      status: "PENDING_REVIEW",
      enrollmentEligibility: "COMPANY_CNPJ_CONFLICT",
    });
    await expect(decisionService.approve(request!.id, admin.actor)).rejects.toThrow("COMPANY_ALREADY_EXISTS");
    await expect(decisionService.reject(request!.id, admin.actor, "CNPJ pertence a uma empresa cadastrada"))
      .resolves.toMatchObject({ request: { status: "REJECTED" } });
    expect(await prisma.accessRequest.findUnique({ where: { id: request!.id } }))
      .toMatchObject({ status: "REJECTED", activeEmail: null });
  });
});
