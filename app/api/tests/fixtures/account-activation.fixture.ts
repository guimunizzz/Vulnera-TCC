/**
 * Monta pedidos aprovados e convites de ativação reais no MySQL de teste.
 * Isola cenários de domínio para os testes SQL e HTTP sem chamar SMTP.
 * Consumido apenas pelos testes de integração da Etapa 5 da Issue #51.
 */
import type { AccessInvitation } from "@prisma/client";
import { prisma } from "../../src/database/prisma.database";
import { AccessRequestEntity, type AccessRequest } from "../../src/models/access-request.model";
import { AccessInvitationRepository } from "../../src/repositories/access-invitation.repository";
import { AccessRequestRepository } from "../../src/repositories/access-request.repository";
import { generateAccessToken } from "../../src/utils/access-token.util";
import { seedUser } from "./users.fixture";

const requests = new AccessRequestRepository(prisma);
const invitations = new AccessInvitationRepository(prisma);
const FIXED_TIME = new Date("2026-11-17T12:00:00.000Z");
let nextEmail = 0;

export type ActivationFixtureStage = "PENDING_EMAIL_VERIFICATION" | "PENDING_REVIEW" | "APPROVED";

export type ActivationInvitationOverrides = Partial<Pick<
  AccessInvitation,
  "expiresAt" | "issuedAt" | "usedAt" | "revokedAt"
>>;

export type AccountActivationFixture = {
  request: AccessRequest;
  invitation: AccessInvitation | null;
  token: string | null;
  reviewerId: string | null;
};

export async function createAccountActivationFixture(options: {
  email?: string;
  name?: string;
  stage?: ActivationFixtureStage;
  now?: Date;
  invitation?: ActivationInvitationOverrides;
} = {}): Promise<AccountActivationFixture> {
  const now = new Date(options.now ?? FIXED_TIME);
  nextEmail += 1;
  const email = options.email ?? `account-activation-${nextEmail}@empresa.local`;
  const created = await requests.createIfEmailAvailable({
    name: options.name ?? "Pessoa em ativação",
    email,
    companyName: "Empresa declarada",
  }, now);
  if (!created) throw new Error("ACTIVATION_FIXTURE_EMAIL_UNAVAILABLE");

  let current = created;
  const stage = options.stage ?? "APPROVED";
  let reviewerId: string | null = null;

  if (stage !== "PENDING_EMAIL_VERIFICATION") {
    const verification = new AccessRequestEntity(current).transitionTo(
      "PENDING_REVIEW",
      undefined,
      undefined,
      now,
    );
    if (!await requests.transitionIfCurrent(current.id, verification)) {
      throw new Error("ACTIVATION_FIXTURE_VERIFICATION_TRANSITION_FAILED");
    }
    current = (await requests.findById(current.id))!;
  }

  if (stage === "APPROVED") {
    const reviewer = await seedUser({
      name: "Revisor de ativação",
      email: `account-activation-reviewer-${nextEmail}@vulnera.local`,
      password: "Activation-fixture-admin-password",
      role: "ADMIN",
    });
    reviewerId = reviewer.id;
    const approval = new AccessRequestEntity(current).transitionTo(
      "APPROVED",
      { userId: reviewer.id, role: "ADMIN" },
      undefined,
      now,
    );
    if (!await requests.transitionIfCurrent(current.id, approval)) {
      throw new Error("ACTIVATION_FIXTURE_APPROVAL_TRANSITION_FAILED");
    }
    current = (await requests.findById(current.id))!;
  }

  if (stage !== "APPROVED") {
    return { request: current, invitation: null, token: null, reviewerId };
  }

  const generated = generateAccessToken();
  // Emite primeiro um slot elegível; os prazos de borda são aplicados depois
  // para que a fixture também possa representar um convite expirado no banco.
  const expiresAt = new Date(now.getTime() + 48 * 60 * 60_000);
  const createdInvitation = await invitations.createIfEligible({
    accessRequestId: current.id,
    tokenHash: generated.tokenHash,
    expiresAt,
  }, now);
  if (!createdInvitation) throw new Error("ACTIVATION_FIXTURE_INVITATION_UNAVAILABLE");

  const invitation = await prisma.accessInvitation.update({
    where: { id: createdInvitation.id },
    data: {
      ...(options.invitation?.expiresAt ? { expiresAt: options.invitation.expiresAt } : {}),
      ...(options.invitation?.issuedAt ? { issuedAt: options.invitation.issuedAt } : {}),
      ...(options.invitation?.usedAt !== undefined ? { usedAt: options.invitation.usedAt } : {}),
      ...(options.invitation?.revokedAt !== undefined ? { revokedAt: options.invitation.revokedAt } : {}),
    },
  });

  return { request: current, invitation, token: generated.token, reviewerId };
}
