/**
 * Regras do ciclo de convite para CLIENT/MEMBER de uma Company existente.
 * Ownership, assinatura e token são revalidados no banco dentro das transações;
 * SMTP só recebe a mensagem após o commit.
 */
import type { EmailSender } from "../models/email.model";
import {
  COMPANY_INVITATION_RESEND_COOLDOWN_MS,
  COMPANY_INVITATION_TTL_MS,
  CompanyInvitationEntity,
  type CompanyInvitation,
  type CompanyInvitationDeliveryStatus,
  type CompanyInvitationResponseDTO,
  type CompanyInvitationHistoryDTO,
  type CompanyMemberResponseDTO,
  type CreateCompanyInvitationDTO,
  type PreparedCompanyInvitation,
} from "../models/company-invitation.model";
import type { User } from "../models/user.model";
import type { UserRepository } from "../repositories/user.repository";
import type { CompanyInvitationRepository } from "../repositories/company-invitation.repository";
import { hashPassword } from "../utils/hash.util";
import { hashAccessToken } from "../utils/access-token.util";
import { isValidCompanyInvitationToken, generateCompanyInvitationToken } from "../utils/company-invitation-token.util";
import { buildCompanyInvitationMessage } from "../utils/company-invitation-message.util";
import {
  assertCompanyInvitationRateLimit,
  type CompanyInvitationRateLimitService,
} from "./company-invitation-rate-limit.service";

type Actor = { userId: string };
type EmailDelivery = { sender: EmailSender; publicWebUrl: string };
type EmailDeliveryLoader = () => EmailDelivery;

const INVALID_INVITATION = "INVALID_COMPANY_INVITATION";

export class CompanyInvitationCooldownError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super("COMPANY_INVITATION_COOLDOWN");
    this.name = "CompanyInvitationCooldownError";
  }
}

export class CompanyInvitationService {
  private readonly clock: () => Date;
  private readonly passwordHasher: (password: string) => Promise<string>;
  private emailDelivery?: EmailDelivery;

  constructor(
    private readonly invitations: CompanyInvitationRepository,
    private readonly users: UserRepository,
    private readonly rateLimiter: Pick<CompanyInvitationRateLimitService, "consumeManagement">,
    private readonly loadEmailDelivery: EmailDeliveryLoader,
    options: { clock?: () => Date; passwordHasher?: (password: string) => Promise<string> } = {},
  ) {
    this.clock = options.clock ?? (() => new Date());
    this.passwordHasher = options.passwordHasher ?? hashPassword;
  }

  async listMembers(actor: Actor): Promise<CompanyMemberResponseDTO[]> {
    const companyId = await this.ownerCompanyId(actor.userId);
    assertCompanyInvitationRateLimit(this.rateLimiter.consumeManagement(actor.userId, companyId));
    return this.invitations.transactionWithRetry(async tx => {
      await this.lockCompanyAndOwner(tx.invitations, tx.users, companyId, actor.userId);
      const members = await tx.invitations.listActiveMembers(companyId);
      return members.map(member => ({
        id: member.id,
        name: member.name,
        email: member.email,
        companyRole: member.companyRole === "OWNER" ? "OWNER" : "MEMBER",
        createdAt: member.createdAt.toISOString(),
      }));
    });
  }

  async listInvitations(actor: Actor): Promise<CompanyInvitationResponseDTO[]> {
    const companyId = await this.ownerCompanyId(actor.userId);
    assertCompanyInvitationRateLimit(this.rateLimiter.consumeManagement(actor.userId, companyId));
    return this.invitations.transactionWithRetry(async tx => {
      await this.lockCompanyAndOwner(tx.invitations, tx.users, companyId, actor.userId);
      const now = this.validNow();
      const rows = await tx.invitations.listByCompany(companyId);
      return rows.map(row => new CompanyInvitationEntity(row).toResponse(now));
    });
  }

  async listInvitationHistory(actor: Actor): Promise<CompanyInvitationHistoryDTO[]> {
    const companyId = await this.ownerCompanyId(actor.userId);
    assertCompanyInvitationRateLimit(this.rateLimiter.consumeManagement(actor.userId, companyId));
    return this.invitations.transactionWithRetry(async tx => {
      await this.lockCompanyAndOwner(tx.invitations, tx.users, companyId, actor.userId);
      const rows = await tx.invitations.listHistory(companyId);
      return rows.map(row => ({
        id: row.id,
        invitationId: row.entityId,
        action: row.action,
        email: readEmailFromAudit(row.diffJson),
        actorName: row.actor.name,
        createdAt: row.createdAt.toISOString(),
      }));
    });
  }

  async createInvitation(
    actor: Actor,
    dto: CreateCompanyInvitationDTO,
  ): Promise<{ invitation: CompanyInvitationResponseDTO; delivery: CompanyInvitationDeliveryStatus }> {
    const companyId = await this.ownerCompanyId(actor.userId);
    const email = normalizeEmail(dto.email);
    assertCompanyInvitationRateLimit(this.rateLimiter.consumeManagement(actor.userId, companyId, email));

    const prepared = await this.invitations.transactionWithRetry(async tx => {
      const company = await this.lockCompanyAndOwner(tx.invitations, tx.users, companyId, actor.userId);
      if (!await tx.invitations.lockActiveSubscription(companyId)) {
        throw new Error("COMPANY_SUBSCRIPTION_NOT_ACTIVE");
      }
      if (await tx.users.findByEmail(email)) throw new Error("COMPANY_INVITATION_NOT_AVAILABLE");

      const now = this.validNow();
      const current = await tx.invitations.lockActiveByEmail(companyId, email);
      if (current && current.expiresAt.getTime() > now.getTime()) {
        throw new Error("COMPANY_INVITATION_NOT_AVAILABLE");
      }
      if (current) this.assertResendCooldown(current, now);

      const token = generateCompanyInvitationToken();
      const expiresAt = new Date(now.getTime() + COMPANY_INVITATION_TTL_MS);
      let row: CompanyInvitation;
      let action: string;
      if (current) {
        const rotated = await tx.invitations.rotate({
          id: current.id,
          companyId,
          expectedTokenHash: current.tokenHash,
          issuerId: actor.userId,
          name: dto.name.trim(),
          tokenHash: token.tokenHash,
          now,
          expiresAt,
        });
        if (!rotated) throw new Error("COMPANY_INVITATION_ROTATION_CONFLICT");
        row = { ...current, issuerId: actor.userId, name: dto.name.trim(), tokenHash: token.tokenHash, issuedAt: now, expiresAt, revokedAt: null, usedAt: null };
        action = "REISSUED";
      } else {
        row = await tx.invitations.create({
          companyId,
          issuerId: actor.userId,
          name: dto.name.trim(),
          email,
          tokenHash: token.tokenHash,
          issuedAt: now,
          expiresAt,
        });
        action = "ISSUED";
      }

      await tx.invitations.recordAudit({
        actorId: actor.userId,
        companyId,
        entityId: row.id,
        action,
        diff: { email, status: "PENDING" },
      });
      return this.prepare(row, company.name, token.token, token.tokenHash);
    });

    const delivery = await this.sendPrepared(prepared);
    return { invitation: await this.getResponse(companyId, prepared.invitationId), delivery };
  }

  async resendInvitation(
    actor: Actor,
    invitationId: string,
  ): Promise<{ invitation: CompanyInvitationResponseDTO; delivery: CompanyInvitationDeliveryStatus }> {
    const companyId = await this.ownerCompanyId(actor.userId);
    const before = await this.invitations.findByIdInCompany(companyId, invitationId);
    if (!before) throw new Error("COMPANY_INVITATION_NOT_FOUND");
    assertCompanyInvitationRateLimit(this.rateLimiter.consumeManagement(actor.userId, companyId, before.email));

    const prepared = await this.invitations.transactionWithRetry(async tx => {
      const company = await this.lockCompanyAndOwner(tx.invitations, tx.users, companyId, actor.userId);
      if (!await tx.invitations.lockActiveSubscription(companyId)) {
        throw new Error("COMPANY_SUBSCRIPTION_NOT_ACTIVE");
      }
      const current = await tx.invitations.lockByIdInCompany(companyId, invitationId);
      if (!current) throw new Error("COMPANY_INVITATION_NOT_FOUND");
      const now = this.validNow();
      if (current.usedAt) throw new Error("COMPANY_INVITATION_ALREADY_USED");
      if (current.revokedAt || current.activeEmail !== current.email) {
        throw new Error("COMPANY_INVITATION_NOT_PENDING");
      }
      this.assertResendCooldown(current, now);
      if (await tx.users.findByEmail(current.email)) throw new Error("COMPANY_INVITATION_NOT_AVAILABLE");

      const token = generateCompanyInvitationToken();
      const expiresAt = new Date(now.getTime() + COMPANY_INVITATION_TTL_MS);
      const rotated = await tx.invitations.rotate({
        id: current.id,
        companyId,
        expectedTokenHash: current.tokenHash,
        issuerId: actor.userId,
        name: current.name,
        tokenHash: token.tokenHash,
        now,
        expiresAt,
      });
      if (!rotated) throw new Error("COMPANY_INVITATION_ROTATION_CONFLICT");

      await tx.invitations.recordAudit({
        actorId: actor.userId,
        companyId,
        entityId: current.id,
        action: "RESENT",
        diff: { email: current.email, status: "PENDING" },
      });
      const updated = { ...current, issuerId: actor.userId, tokenHash: token.tokenHash, issuedAt: now, expiresAt };
      return this.prepare(updated, company.name, token.token, token.tokenHash);
    });

    const delivery = await this.sendPrepared(prepared);
    return { invitation: await this.getResponse(companyId, prepared.invitationId), delivery };
  }

  async revokeInvitation(actor: Actor, invitationId: string): Promise<void> {
    const companyId = await this.ownerCompanyId(actor.userId);
    const before = await this.invitations.findByIdInCompany(companyId, invitationId);
    if (!before) throw new Error("COMPANY_INVITATION_NOT_FOUND");
    assertCompanyInvitationRateLimit(this.rateLimiter.consumeManagement(actor.userId, companyId, before.email));

    await this.invitations.transactionWithRetry(async tx => {
      await this.lockCompanyAndOwner(tx.invitations, tx.users, companyId, actor.userId);
      const current = await tx.invitations.lockByIdInCompany(companyId, invitationId);
      if (!current) throw new Error("COMPANY_INVITATION_NOT_FOUND");
      if (current.usedAt) throw new Error("COMPANY_INVITATION_ALREADY_USED");
      if (current.revokedAt) return;
      const now = this.validNow();
      const revoked = await tx.invitations.revoke({
        id: current.id,
        companyId,
        expectedTokenHash: current.tokenHash,
        now,
      });
      if (!revoked) throw new Error("COMPANY_INVITATION_REVOCATION_CONFLICT");
      await tx.invitations.recordAudit({
        actorId: actor.userId,
        companyId,
        entityId: current.id,
        action: "REVOKED",
        diff: { email: current.email, status: "REVOKED" },
      });
    });
  }

  async deactivateMember(actor: Actor, userId: string): Promise<void> {
    const companyId = await this.ownerCompanyId(actor.userId);
    const before = await this.users.findById(userId);
    assertCompanyInvitationRateLimit(this.rateLimiter.consumeManagement(actor.userId, companyId, before?.email));

    await this.invitations.transactionWithRetry(async tx => {
      const company = await tx.invitations.lockCompany(companyId);
      if (!company) throw new Error("COMPANY_NOT_FOUND");

      const lockedUsers = new Map<string, User>();
      for (const id of [...new Set([actor.userId, userId])].sort()) {
        const user = await tx.users.lockById(id);
        if (user) lockedUsers.set(id, user);
      }
      const owner = lockedUsers.get(actor.userId);
      this.assertOwner(owner, companyId);
      const target = lockedUsers.get(userId);
      if (!target || target.companyId !== companyId || target.role !== "CLIENT" || target.companyRole !== "MEMBER") {
        throw new Error("COMPANY_MEMBER_NOT_FOUND");
      }
      if (target.deactivatedAt) return;

      const now = this.validNow();
      await tx.users.markDeactivated(target.id, now);
      await tx.refreshTokens.revokeAllForUser(target.id, now);
      await tx.invitations.recordAudit({
        actorId: actor.userId,
        companyId,
        entityType: "User",
        entityId: target.id,
        action: "DEACTIVATE",
        diff: { from: "ACTIVE", to: "DEACTIVATED", companyRole: "MEMBER" },
      });
    });
  }

  async validate(token: string): Promise<{ valid: boolean }> {
    if (!isValidCompanyInvitationToken(token)) return { valid: false };
    try {
      const now = this.validNow();
      const invitation = await this.invitations.findByHash(hashAccessToken(token));
      if (!invitation || !isUsableInvitation(invitation, hashAccessToken(token), now)) return { valid: false };
      if (!await this.isCurrentIssuer(invitation.issuerId, invitation.companyId)) return { valid: false };
      if (!await this.invitations.hasActiveSubscription(invitation.companyId)) return { valid: false };
      if (await this.users.findByEmail(invitation.email)) return { valid: false };
      return { valid: true };
    } catch {
      throw new Error("COMPANY_INVITATION_VALIDATION_FAILED");
    }
  }

  async activate(token: string, password: string): Promise<void> {
    if (!isValidCompanyInvitationToken(token)) throw new Error(INVALID_INVITATION);
    const tokenHash = hashAccessToken(token);
    const precheckNow = this.validNow();
    const candidate = await this.invitations.findByHash(tokenHash);
    if (!candidate || !isUsableInvitation(candidate, tokenHash, precheckNow)) throw new Error(INVALID_INVITATION);
    if (!await this.isCurrentIssuer(candidate.issuerId, candidate.companyId)) throw new Error(INVALID_INVITATION);
    if (!await this.invitations.hasActiveSubscription(candidate.companyId)) throw new Error(INVALID_INVITATION);
    if (await this.users.findByEmail(candidate.email)) throw new Error(INVALID_INVITATION);

    const passwordHash = await this.passwordHasher(password);
    try {
      await this.invitations.transactionWithRetry(async tx => {
        const company = await tx.invitations.lockCompany(candidate.companyId);
        if (!company) throw new Error(INVALID_INVITATION);

        const issuer = await tx.users.lockById(candidate.issuerId);
        if (!isEligibleIssuer(issuer, candidate.companyId)) throw new Error(INVALID_INVITATION);
        if (!await tx.invitations.lockActiveSubscription(candidate.companyId)) throw new Error(INVALID_INVITATION);

        const current = await tx.invitations.lockByIdInCompany(candidate.companyId, candidate.id);
        const now = this.validNow();
        if (
          !current
          || current.issuerId !== candidate.issuerId
          || !isUsableInvitation(current, tokenHash, now)
        ) {
          throw new Error(INVALID_INVITATION);
        }
        if (await tx.users.findByEmail(current.email)) throw new Error(INVALID_INVITATION);

        if (!await tx.invitations.consume({
          id: current.id,
          companyId: current.companyId,
          tokenHash,
          now,
        })) {
          throw new Error(INVALID_INVITATION);
        }

        const member = await tx.users.create({
          name: current.name,
          email: current.email,
          password: passwordHash,
          role: "CLIENT",
          companyId: current.companyId,
          companyRole: "MEMBER",
        }, { uniqueEmailConflictCode: "USER_EMAIL_ALREADY_EXISTS" });
        await tx.invitations.recordAudit({
          actorId: member.id,
          companyId: current.companyId,
          entityId: current.id,
          action: "ACCEPTED",
          diff: { email: current.email, companyRole: "MEMBER" },
        });
      });
    } catch (error) {
      if (error instanceof Error && (error.message === INVALID_INVITATION || error.message === "USER_EMAIL_ALREADY_EXISTS")) {
        throw new Error(INVALID_INVITATION);
      }
      throw new Error("COMPANY_INVITATION_ACTIVATION_FAILED");
    }
  }

  private async lockCompanyAndOwner(
    invitationRepository: CompanyInvitationRepository,
    userRepository: UserRepository,
    companyId: string,
    actorId: string,
  ): Promise<{ id: string; name: string }> {
    const company = await invitationRepository.lockCompany(companyId);
    if (!company) throw new Error("COMPANY_NOT_FOUND");
    const owner = await userRepository.lockById(actorId);
    this.assertOwner(owner, companyId);
    return company;
  }

  private assertOwner(user: User | null | undefined, companyId: string): asserts user is User {
    if (!isEligibleIssuer(user, companyId)) throw new Error("FORBIDDEN");
  }

  private async ownerCompanyId(userId: string): Promise<string> {
    const user = await this.users.findById(userId);
    if (!isEligibleIssuer(user, user?.companyId ?? "")) throw new Error("FORBIDDEN");
    return user.companyId!;
  }

  private async isCurrentIssuer(userId: string, companyId: string): Promise<boolean> {
    return isEligibleIssuer(await this.users.findById(userId), companyId);
  }

  private prepare(invitation: CompanyInvitation, companyName: string, token: string, tokenHash: string): PreparedCompanyInvitation {
    return {
      invitationId: invitation.id,
      companyId: invitation.companyId,
      companyName,
      issuerId: invitation.issuerId,
      name: invitation.name,
      email: invitation.email,
      token,
      tokenHash,
      expiresAt: invitation.expiresAt,
    };
  }

  private async sendPrepared(prepared: PreparedCompanyInvitation): Promise<CompanyInvitationDeliveryStatus> {
    try {
      const delivery = this.emailDelivery ??= this.loadEmailDelivery();
      const message = buildCompanyInvitationMessage({
        to: prepared.email,
        name: prepared.name,
        companyName: prepared.companyName,
        token: prepared.token,
        expiresAt: prepared.expiresAt,
      }, delivery.publicWebUrl);
      await delivery.sender.send(message);
      return "SENT";
    } catch {
      await this.invalidateFailedDelivery(prepared);
      return "DELIVERY_FAILED";
    }
  }

  private async invalidateFailedDelivery(prepared: PreparedCompanyInvitation): Promise<void> {
    try {
      await this.invitations.transactionWithRetry(async tx => {
        const company = await tx.invitations.lockCompany(prepared.companyId);
        if (!company) return;
        await tx.users.lockById(prepared.issuerId);
        const current = await tx.invitations.lockByIdInCompany(prepared.companyId, prepared.invitationId);
        if (!current || current.tokenHash !== prepared.tokenHash || current.usedAt || current.revokedAt) return;
        const now = this.validNow();
        const revoked = await tx.invitations.revoke({
          id: current.id,
          companyId: current.companyId,
          expectedTokenHash: prepared.tokenHash,
          now,
        });
        if (revoked) {
          await tx.invitations.recordAudit({
            actorId: prepared.issuerId,
            companyId: prepared.companyId,
            entityId: current.id,
            action: "DELIVERY_FAILED",
            diff: { email: current.email, status: "REVOKED" },
          });
        }
      });
    } catch {
      throw new Error("COMPANY_INVITATION_CLEANUP_FAILED");
    }
  }

  private async getResponse(companyId: string, invitationId: string): Promise<CompanyInvitationResponseDTO> {
    const row = await this.invitations.findByIdInCompany(companyId, invitationId);
    if (!row) throw new Error("COMPANY_INVITATION_NOT_FOUND");
    return new CompanyInvitationEntity(row).toResponse(this.validNow());
  }

  private assertResendCooldown(invitation: CompanyInvitation, now: Date): void {
    const availableAt = invitation.issuedAt.getTime() + COMPANY_INVITATION_RESEND_COOLDOWN_MS;
    if (availableAt > now.getTime()) {
      throw new CompanyInvitationCooldownError(Math.max(1, Math.ceil((availableAt - now.getTime()) / 1_000)));
    }
  }

  private validNow(): Date {
    const now = this.clock();
    if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new Error("INVALID_COMPANY_INVITATION_TIME");
    return now;
  }
}

function isEligibleIssuer(user: User | null | undefined, companyId: string): user is User {
  return !!user
    && user.deactivatedAt === null
    && user.role === "CLIENT"
    && user.companyRole === "OWNER"
    && user.companyId === companyId;
}

function isUsableInvitation(invitation: CompanyInvitation, tokenHash: string, now: Date): boolean {
  return invitation.tokenHash === tokenHash
    && invitation.activeEmail === invitation.email
    && invitation.usedAt === null
    && invitation.revokedAt === null
    && invitation.issuedAt.getTime() <= now.getTime()
    && invitation.expiresAt.getTime() > now.getTime()
    && invitation.expiresAt.getTime() > invitation.issuedAt.getTime();
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function readEmailFromAudit(diffJson: string | null): string | null {
  if (!diffJson) return null;
  try {
    const value: unknown = JSON.parse(diffJson);
    if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
    const email = (value as Record<string, unknown>).email;
    return typeof email === "string" && email.length <= 191 ? email : null;
  } catch {
    return null;
  }
}
