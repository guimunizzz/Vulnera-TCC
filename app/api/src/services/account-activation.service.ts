/**
 * Ativa um convite aprovado e, em adesões novas, cria OWNER, Company e Subscription ACTIVE.
 * Pedidos legados continuam criando CLIENT sem vínculo para retomar onboarding.
 * Consumo, identidade, vínculo e auditorias compartilham o mesmo commit; nunca emite JWT.
 */
import type { AccessInvitation } from "../models/access-invitation.model";
import {
  AccessRequestEntity,
  type AccessRequest,
  type AccessRequestEnrollment,
} from "../models/access-request.model";
import {
  isValidAccountActivationToken,
  type ValidationResponseDTO,
} from "../models/account-activation.model";
import type { AccessInvitationRepository } from "../repositories/access-invitation.repository";
import type { AccessRequestRepository } from "../repositories/access-request.repository";
import { hashAccessToken } from "../utils/access-token.util";
import { hashPassword } from "../utils/hash.util";

const INVALID_ACTIVATION_TOKEN = "INVALID_ACTIVATION_TOKEN";

export class AccountActivationService {
  constructor(
    private readonly requests: AccessRequestRepository,
    private readonly invitations: AccessInvitationRepository,
    private readonly passwordHasher: (password: string) => Promise<string> = hashPassword,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  /** Verifica o convite sem alterar tokens, pedidos, usuários ou auditoria. */
  async validate(token: string): Promise<ValidationResponseDTO> {
    if (!isValidAccountActivationToken(token)) return { valid: false };
    try {
      const now = this.clock();
      if (!isValidDate(now)) return { valid: false };

      const candidate = await this.findUsableCandidate(token, now);
      if (!candidate) return { valid: false };
      if (await this.requests.existsUserByEmail(candidate.request.email)) return { valid: false };
      if (candidate.enrollment) {
        if (!await this.requests.isEnrollmentPlanCurrent(candidate.enrollment)) return { valid: false };
        if (await this.requests.hasEnrollmentCompanyCnpjConflict(candidate.enrollment)) return { valid: false };
      }
      return { valid: true };
    } catch {
      throw new Error("ACCOUNT_ACTIVATION_VALIDATION_FAILED");
    }
  }

  /** Revalida sob locks e confirma toda a ativação em uma única transação. */
  async activate(token: string, password: string): Promise<void> {
    if (!isValidAccountActivationToken(token)) throw new Error(INVALID_ACTIVATION_TOKEN);

    try {
      const tokenHash = hashAccessToken(token);
      const precheckNow = this.clock();
      if (!isValidDate(precheckNow)) throw new Error(INVALID_ACTIVATION_TOKEN);

      // O hash de senha só é calculado depois de provar que o token ainda parece elegível.
      const candidate = await this.findUsableCandidate(token, precheckNow);
      if (!candidate || await this.requests.existsUserByEmail(candidate.request.email)) {
        throw new Error(INVALID_ACTIVATION_TOKEN);
      }
      const passwordHash = await this.passwordHasher(password);

      await this.requests.transactionWithRetry(async ({ requests, invitations, enrollments, users }) => {
        // Todos os escritores do domínio usam esta ordem para evitar snapshots antigos.
        const parent = await requests.findByIdForUpdate(candidate.request.id);
        if (!parent) throw new Error(INVALID_ACTIVATION_TOKEN);
        const current = await invitations.findByAccessRequestIdForUpdate(parent.id);
        const enrollment = await enrollments.findByAccessRequestIdForUpdate(parent.id);
        const lockedPlan = enrollment
          ? await enrollments.findPlanForUpdate(enrollment.planId)
          : null;
        const existingUser = await users.findByEmail(parent.email);
        const companyCnpjConflict = enrollment?.companyCnpj
          ? await enrollments.companyCnpjIsInUse(enrollment.companyCnpj)
          : false;
        // O prazo usa o instante posterior aos locks e leituras que podem esperar.
        const now = this.clock();
        if (!isValidDate(now)) throw new Error(INVALID_ACTIVATION_TOKEN);
        if (!isUsableInvitation(parent, current, tokenHash, now)) {
          throw new Error(INVALID_ACTIVATION_TOKEN);
        }
        if (enrollment) enrollments.assertSnapshotMatchesPlan(enrollment, lockedPlan);
        if (companyCnpjConflict) throw new Error("COMPANY_ALREADY_EXISTS");
        if (existingUser) throw new Error(INVALID_ACTIVATION_TOKEN);

        // A condição do UPDATE arbitra o uso único dentro da mesma transação.
        if (!await invitations.consumeIfAvailable(tokenHash, now)) {
          throw new Error(INVALID_ACTIVATION_TOKEN);
        }
        const company = enrollment
          ? await enrollments.createCompany({
            name: parent.companyName,
            enrollment,
          })
          : null;
        const user = await users.create({
          name: parent.name,
          email: parent.email,
          password: passwordHash,
          role: "CLIENT",
          companyId: company?.id ?? null,
          companyRole: company ? "OWNER" : null,
          legacyOnboardingAllowed: !enrollment,
        }, { uniqueEmailConflictCode: "USER_EMAIL_ALREADY_EXISTS" });

        if (enrollment) {
          if (!parent.reviewedById) throw new Error(INVALID_ACTIVATION_TOKEN);
          await enrollments.createActiveSubscription({
            companyId: company!.id,
            ownerId: user.id,
            reviewedById: parent.reviewedById!,
            enrollment,
            now,
          });
        }

        const transition = new AccessRequestEntity(parent).transitionTo(
          "ACTIVATED",
          undefined,
          undefined,
          now,
        );
        if (!await requests.transitionIfCurrent(parent.id, transition)) {
          throw new Error(INVALID_ACTIVATION_TOKEN);
        }
        await requests.createActivationAuditEvent(parent.id, user.id, now, company?.id ?? null);
      }, false);
    } catch (error) {
      if (error instanceof Error && (error.message === INVALID_ACTIVATION_TOKEN
        || error.message === "USER_EMAIL_ALREADY_EXISTS")) {
        throw new Error(INVALID_ACTIVATION_TOKEN);
      }
      if (error instanceof Error && [
        "ACCESS_REQUEST_PLAN_NOT_FOUND",
        "ACCESS_REQUEST_PLAN_UNAVAILABLE",
        "ACCESS_REQUEST_PLAN_CHANGED",
        "COMPANY_ALREADY_EXISTS",
      ].includes(error.message)) throw error;
      throw new Error("ACCOUNT_ACTIVATION_FAILED");
    }
  }
  private async findUsableCandidate(
    token: string,
    now: Date,
  ): Promise<{ request: AccessRequest; invitation: AccessInvitation; enrollment: AccessRequestEnrollment | null } | null> {
    const tokenHash = hashAccessToken(token);
    const invitation = await this.invitations.findByHash(tokenHash);
    if (!invitation || invitation.tokenHash !== tokenHash) return null;
    const request = await this.requests.findById(invitation.accessRequestId);
    if (!request || !isUsableInvitation(request, invitation, tokenHash, now)) return null;
    const enrollment = await this.requests.findEnrollmentByAccessRequestId(request.id);
    return { request, invitation, enrollment };
  }
}

function isUsableInvitation(
  request: AccessRequest,
  invitation: AccessInvitation | null,
  tokenHash: string,
  now: Date,
): invitation is AccessInvitation {
  if (!isValidDate(now) || !invitation) return false;
  if (request.status !== "APPROVED" || request.emailVerifiedAt === null || request.reviewedAt === null) return false;
  if (!isValidDate(request.expiresAt) || !isValidDate(request.emailVerifiedAt) || !isValidDate(request.reviewedAt)) return false;
  if (request.emailVerifiedAt.getTime() > request.reviewedAt.getTime()) return false;
  if (request.reviewedAt.getTime() > now.getTime() || request.expiresAt.getTime() <= now.getTime()) return false;
  if (invitation.accessRequestId !== request.id || invitation.tokenHash !== tokenHash) return false;
  if (invitation.usedAt !== null || invitation.revokedAt !== null) return false;
  if (!isValidDate(invitation.issuedAt) || !isValidDate(invitation.expiresAt)) return false;
  if (invitation.issuedAt.getTime() < request.reviewedAt.getTime() || invitation.issuedAt.getTime() > now.getTime()) return false;
  if (invitation.expiresAt.getTime() <= now.getTime() || invitation.expiresAt.getTime() <= invitation.issuedAt.getTime()) return false;
  if (invitation.expiresAt.getTime() > request.expiresAt.getTime()) return false;
  return true;
}

function isValidDate(value: Date): boolean {
  return value instanceof Date && Number.isFinite(value.getTime());
}
