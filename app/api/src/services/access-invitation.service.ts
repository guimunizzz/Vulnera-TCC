// Prepara convites no ciclo transacional e entrega a mensagem após o commit.
// Existe para ligar aprovação administrativa a tokens de uso único sem criar User.

import { AccessRequestEntity, type AccessRequest } from "../models/access-request.model";
import {
  AccessInvitationCooldownError,
  type InvitationDeliveryStatus,
  type PreparedAccessInvitation,
} from "../models/access-invitation.model";
import type { AccessRequestAdminActor } from "../models/admin-access-request.model";
import type { EmailSender } from "../models/email.model";
import type { AccessRequestRepository, AccessRepositories } from "../repositories/access-request.repository";
import type { AccessRequestAdminAuthorizationService } from "./access-request-admin-authorization.service";
import { accessTokenDeadline } from "../models/access-token.model";
import { generateAccessToken } from "../utils/access-token.util";
import { buildAccessInvitationMessage } from "../utils/access-invitation-message.util";

const DEFAULT_COOLDOWN_MS = 60_000;

const SAFE_ACCESS_INVITATION_ERRORS = new Set([
  "ACCESS_REQUEST_NOT_FOUND",
  "ACCESS_REQUEST_EXPIRED",
  "ACCESS_REQUEST_USER_ALREADY_EXISTS",
  "ACCESS_REQUEST_TRANSITION_CONFLICT",
  "ACCESS_INVITATION_ALREADY_EXISTS",
  "ACCESS_INVITATION_ALREADY_USED",
  "ACCESS_INVITATION_PREPARATION_CONFLICT",
  "ACCESS_INVITATION_ROTATION_CONFLICT",
  "ACCESS_INVITATION_INVALID_COOLDOWN_MS",
  "ACCESS_INVITATION_INVALID_TIME",
  "INVALID_STATUS_TRANSITION",
]);

export class AccessInvitationService {
  private readonly clock: () => Date;
  private readonly cooldownMs: number;

  constructor(
    private readonly requests: AccessRequestRepository,
    private readonly sender: EmailSender,
    private readonly publicWebUrl: string,
    private readonly authorization: Pick<AccessRequestAdminAuthorizationService, "ensureAdmin">,
    options: { clock?: () => Date; cooldownMs?: number } = {},
  ) {
    this.clock = options.clock ?? (() => new Date());
    this.cooldownMs = options.cooldownMs ?? DEFAULT_COOLDOWN_MS;
    if (!Number.isSafeInteger(this.cooldownMs) || this.cooldownMs < 0) {
      throw new Error("ACCESS_INVITATION_INVALID_COOLDOWN_MS");
    }
  }

  /** Cria o slot e a auditoria na transação de aprovação já aberta pelo chamador. */
  async prepareInitial(
    repositories: AccessRepositories,
    accessRequestId: string,
    actor: AccessRequestAdminActor,
    now: Date,
  ): Promise<PreparedAccessInvitation> {
    try {
      if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
        throw new Error("ACCESS_INVITATION_INVALID_TIME");
      }

      const parent = await repositories.requests.findByIdForUpdate(accessRequestId);
      if (!parent) throw new Error("ACCESS_REQUEST_NOT_FOUND");
      if (parent.status !== "APPROVED") throw new Error("INVALID_STATUS_TRANSITION");
      if (now.getTime() >= parent.expiresAt.getTime()) throw new Error("ACCESS_REQUEST_EXPIRED");

      const current = await repositories.invitations.findByAccessRequestIdForUpdate(parent.id);
      if (current) throw new Error("ACCESS_INVITATION_ALREADY_EXISTS");

      const { token, tokenHash } = generateAccessToken();
      const expiresAt = accessTokenDeadline("INVITATION", parent.expiresAt, now);
      const created = await repositories.invitations.createIfEligible({
        accessRequestId: parent.id,
        tokenHash,
        expiresAt,
      }, now);
      if (!created) throw new Error("ACCESS_INVITATION_PREPARATION_CONFLICT");

      await repositories.requests.createInvitationAuditEvent(
        parent.id,
        "ACCESS_INVITATION_ISSUED",
        actor.userId,
        now,
      );

      return this.toPrepared(parent, actor.userId, token, tokenHash, expiresAt);
    } catch (error) {
      if (isSafeAccessInvitationError(error)) throw error;
      throw new Error("ACCESS_INVITATION_PERSISTENCE_FAILED");
    }
  }

  /** Envia somente um preparo já commitado pelo chamador administrativo. */
  async sendPrepared(prepared: PreparedAccessInvitation): Promise<InvitationDeliveryStatus> {
    try {
      const message = buildAccessInvitationMessage({
        to: prepared.to,
        name: prepared.name,
        token: prepared.token,
        expiresAt: prepared.expiresAt,
      }, this.publicWebUrl);
      await this.sender.send(message);
      return "SENT";
    } catch {
      await this.invalidateFailedDelivery(prepared);
      return "DELIVERY_FAILED";
    }
  }

  /** Reemite após revalidar ADMIN; o envio fica fora da transação e do retry. */
  async resend(
    accessRequestId: string,
    actor: AccessRequestAdminActor,
  ): Promise<{ request: AccessRequest; invitationDelivery: InvitationDeliveryStatus }> {
    await this.authorization.ensureAdmin(actor);

    const outcome = await this.withPersistence(() => this.requests.transactionWithRetry(
      async ({ requests, invitations }) => {
        const parent = await requests.findByIdForUpdate(accessRequestId);
        if (!parent) throw new Error("ACCESS_REQUEST_NOT_FOUND");

        const now = this.clock();
        if (parent.status === "APPROVED" && now.getTime() >= parent.expiresAt.getTime()) {
          const expiration = new AccessRequestEntity(parent).transitionTo("EXPIRED", undefined, undefined, now);
          if (!await requests.transitionIfCurrent(parent.id, expiration)) {
            throw new Error("ACCESS_REQUEST_TRANSITION_CONFLICT");
          }
          // O chamador apresenta o erro somente depois que a expiração for commitada.
          return { kind: "EXPIRED" } as const;
        }

        if (parent.status !== "APPROVED") throw new Error("INVALID_STATUS_TRANSITION");
        if (await requests.existsUserByEmail(parent.email)) {
          throw new Error("ACCESS_REQUEST_USER_ALREADY_EXISTS");
        }

        const current = await invitations.findByAccessRequestIdForUpdate(parent.id);
        if (current?.usedAt) throw new Error("ACCESS_INVITATION_ALREADY_USED");
        if (current && current.issuedAt.getTime() + this.cooldownMs > now.getTime()) {
          const retryAfterSeconds = Math.max(
            1,
            Math.ceil((current.issuedAt.getTime() + this.cooldownMs - now.getTime()) / 1_000),
          );
          throw new AccessInvitationCooldownError(retryAfterSeconds);
        }

        const { token, tokenHash } = generateAccessToken();
        const expiresAt = accessTokenDeadline("INVITATION", parent.expiresAt, now);
        if (current) {
          const rotated = await invitations.rotateIfAvailable({
            accessRequestId: parent.id,
            tokenHash,
            expiresAt,
            expectedTokenHash: current.tokenHash,
            expectedRevokedAt: current.revokedAt,
          }, now);
          if (!rotated) throw new Error("ACCESS_INVITATION_ROTATION_CONFLICT");
        } else {
          const created = await invitations.createIfEligible({
            accessRequestId: parent.id,
            tokenHash,
            expiresAt,
          }, now);
          if (!created) throw new Error("ACCESS_INVITATION_PREPARATION_CONFLICT");
        }

        await requests.createInvitationAuditEvent(
          parent.id,
          current ? "ACCESS_INVITATION_REISSUED" : "ACCESS_INVITATION_ISSUED",
          actor.userId,
          now,
        );

        return {
          kind: "PREPARED",
          request: parent,
          delivery: this.toPrepared(parent, actor.userId, token, tokenHash, expiresAt),
        } as const;
      },
      false,
    ));

    if (outcome.kind === "EXPIRED") throw new Error("ACCESS_REQUEST_EXPIRED");
    const invitationDelivery = await this.sendPrepared(outcome.delivery);
    return { request: outcome.request, invitationDelivery };
  }

  private toPrepared(
    request: AccessRequest,
    actorId: string,
    token: string,
    tokenHash: string,
    expiresAt: Date,
  ): PreparedAccessInvitation {
    return {
      accessRequestId: request.id,
      to: request.email,
      name: request.name,
      token,
      tokenHash,
      expiresAt,
      actorId,
    };
  }

  private async invalidateFailedDelivery(prepared: PreparedAccessInvitation): Promise<void> {
    try {
      await this.requests.transactionWithRetry(async ({ requests, invitations }) => {
        const parent = await requests.findByIdForUpdate(prepared.accessRequestId);
        if (!parent) return;

        const now = this.clock();
        const revoked = await invitations.revokeIfAvailable({
          accessRequestId: prepared.accessRequestId,
          expectedTokenHash: prepared.tokenHash,
        }, now);
        if (revoked) {
          await requests.createInvitationAuditEvent(
            prepared.accessRequestId,
            "ACCESS_INVITATION_DELIVERY_FAILED",
            prepared.actorId,
            now,
          );
        }
      }, false);
    } catch {
      // A resposta nunca sugere token válido quando o cleanup falha.
      throw new Error("ACCESS_INVITATION_CLEANUP_FAILED");
    }
  }

  private async withPersistence<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (isSafeAccessInvitationError(error)) throw error;
      throw new Error("ACCESS_INVITATION_PERSISTENCE_FAILED");
    }
  }
}

function isSafeAccessInvitationError(error: unknown): boolean {
  return error instanceof AccessInvitationCooldownError
    || (error instanceof Error && SAFE_ACCESS_INVITATION_ERRORS.has(error.message));
}
