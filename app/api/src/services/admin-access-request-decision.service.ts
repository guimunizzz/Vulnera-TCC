// Orquestra decisões administrativas sobre solicitações verificadas.
// Mantém decisão, reserva, histórico e preparo do convite na mesma transação;
// o serviço de convites envia a mensagem somente depois do commit.
// Consumido pela camada HTTP administrativa de acesso.

import { AccessRequestEntity, type AccessRequest, type AccessRequestEnrollment } from "../models/access-request.model";
import type { AccessRequestAdminActor } from "../models/admin-access-request.model";
import type { AccessRequestRepository } from "../repositories/access-request.repository";
import type { AccessInvitationService } from "./access-invitation.service";
import type { AccessRequestAdminAuthorizationService } from "./access-request-admin-authorization.service";

const SAFE_DECISION_ERRORS = new Set([
  "FORBIDDEN",
  "INVALID_STATUS_TRANSITION",
  "ACCESS_REQUEST_NOT_FOUND",
  "ACCESS_REQUEST_EXPIRED",
  "ACCESS_REQUEST_USER_ALREADY_EXISTS",
  "ACCESS_REQUEST_EMAIL_NOT_VERIFIED",
  "ACCESS_REQUEST_PLAN_NOT_FOUND",
  "ACCESS_REQUEST_PLAN_UNAVAILABLE",
  "ACCESS_REQUEST_PLAN_CHANGED",
  "ACCESS_REQUEST_INVALIDATION_REASON_REQUIRED",
  "COMPANY_ALREADY_EXISTS",
  "ACCESS_REQUEST_TRANSITION_CONFLICT",
  "ACCESS_INVITATION_ALREADY_EXISTS",
  "ACCESS_INVITATION_ALREADY_USED",
  "ACCESS_INVITATION_PREPARATION_CONFLICT",
  "ACCESS_INVITATION_PERSISTENCE_FAILED",
  "ACCESS_INVITATION_CLEANUP_FAILED",
  "ACCESS_REQUEST_DECISION_PERSISTENCE_FAILED",
]);

const INCOMPATIBLE_ENROLLMENT_ERRORS = new Set([
  "ACCESS_REQUEST_PLAN_NOT_FOUND",
  "ACCESS_REQUEST_PLAN_UNAVAILABLE",
  "ACCESS_REQUEST_PLAN_CHANGED",
]);

export type AdminAccessRequestApproval = {
  request: AccessRequest;
  enrollment: AccessRequestEnrollment | null;
  invitationDelivery: "SENT" | "DELIVERY_FAILED";
};

export class AdminAccessRequestDecisionService {
  constructor(
    private readonly requests: AccessRequestRepository,
    private readonly invitationService: Pick<AccessInvitationService, "prepareInitial" | "sendPrepared">,
    private readonly authorization: Pick<AccessRequestAdminAuthorizationService, "ensureAdmin">,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async approve(id: string, actor: AccessRequestAdminActor): Promise<AdminAccessRequestApproval> {
    // Revalida papel e estado atual da conta antes de revelar se o pedido existe.
    await withSafeDecisionErrors(() => this.authorization.ensureAdmin(actor));

    const outcome = await withSafeDecisionErrors(() => this.requests.transactionWithRetry(async repositories => {
      const parent = await repositories.requests.findByIdForUpdate(id);
      if (!parent) throw new Error("ACCESS_REQUEST_NOT_FOUND");
      await repositories.requests.lockActiveAdminForUpdate(actor.userId);

      if (parent.status !== "PENDING_REVIEW") throw new Error("INVALID_STATUS_TRANSITION");
      if (!parent.emailVerifiedAt) throw new Error("ACCESS_REQUEST_EMAIL_NOT_VERIFIED");

      // A consulta usa a collation real de User.email, preservando a equivalência
      // MySQL em vez de tentar reproduzi-la em JavaScript.
      const existingUser = await repositories.requests.existsUserByEmail(parent.email);

      // Ordem de locks: pedido → ator ADMIN → convite → adesão → plano.
      const currentInvitation = await repositories.invitations.findByAccessRequestIdForUpdate(parent.id);
      if (currentInvitation) throw new Error("ACCESS_INVITATION_ALREADY_EXISTS");
      const enrollment = await repositories.enrollments.findByAccessRequestIdForUpdate(parent.id);
      const lockedPlan = enrollment
        ? await repositories.enrollments.findPlanForUpdate(enrollment.planId)
        : null;
      const companyCnpjConflict = enrollment?.companyCnpj
        ? await repositories.enrollments.companyCnpjIsInUse(enrollment.companyCnpj)
        : false;

      // O prazo usa o instante posterior aos locks e leituras que podem esperar.
      const now = this.clock();
      if (now.getTime() >= parent.expiresAt.getTime()) {
        const expiration = new AccessRequestEntity(parent).transitionTo("EXPIRED", undefined, undefined, now);
        if (!await repositories.requests.transitionIfCurrent(parent.id, expiration)) {
          throw new Error("ACCESS_REQUEST_TRANSITION_CONFLICT");
        }
        // O retorno especial permite commitar a liberação antes de expor o 422.
        return { kind: "EXPIRED" } as const;
      }

      if (existingUser) throw new Error("ACCESS_REQUEST_USER_ALREADY_EXISTS");
      if (enrollment) {
        repositories.enrollments.assertSnapshotMatchesPlan(enrollment, lockedPlan);
      }
      if (companyCnpjConflict) throw new Error("COMPANY_ALREADY_EXISTS");

      const approval = new AccessRequestEntity(parent).transitionTo("APPROVED", actor, undefined, now);
      if (!await repositories.requests.transitionIfCurrent(parent.id, approval)) {
        throw new Error("ACCESS_REQUEST_TRANSITION_CONFLICT");
      }

      const approved = await repositories.requests.findById(parent.id);
      if (!approved) throw new Error("ACCESS_REQUEST_TRANSITION_CONFLICT");

      // Hash, evento de auditoria e a decisão aprovada compartilham o mesmo tx.
      // O objeto preparado fica apenas em memória para o envio pós-commit.
      const prepared = await this.invitationService.prepareInitial(
        repositories,
        parent.id,
        actor,
        now,
      );
      return { kind: "APPROVED", request: approved, enrollment, prepared } as const;
    }));

    if (outcome.kind === "EXPIRED") throw new Error("ACCESS_REQUEST_EXPIRED");

    const invitationDelivery = await withSafeDecisionErrors(
      () => this.invitationService.sendPrepared(outcome.prepared),
    );
    return { request: outcome.request, enrollment: outcome.enrollment, invitationDelivery };
  }

  async reject(
    id: string,
    actor: AccessRequestAdminActor,
    reason?: string | null,
  ): Promise<{ request: AccessRequest; enrollment: AccessRequestEnrollment | null }> {
    await withSafeDecisionErrors(() => this.authorization.ensureAdmin(actor));

    const outcome = await withSafeDecisionErrors(() => this.requests.transactionWithRetry(async ({ requests, invitations, enrollments }) => {
      const parent = await requests.findByIdForUpdate(id);
      if (!parent) throw new Error("ACCESS_REQUEST_NOT_FOUND");
      await requests.lockActiveAdminForUpdate(actor.userId);
      if (parent.status !== "PENDING_REVIEW" && parent.status !== "APPROVED") {
        throw new Error("INVALID_STATUS_TRANSITION");
      }

      let transitionReason = reason ?? undefined;
      let enrollment: AccessRequestEnrollment | null = null;
      let incompatibility: string | null = null;
      let invalidationReason = "";
      if (parent.status === "APPROVED") {
        invalidationReason = reason?.trim() ?? "";
        if (!invalidationReason) throw new Error("ACCESS_REQUEST_INVALIDATION_REASON_REQUIRED");
        const invitation = await invitations.findByAccessRequestIdForUpdate(parent.id);
        if (invitation?.usedAt) throw new Error("ACCESS_INVITATION_ALREADY_USED");

        enrollment = await enrollments.findByAccessRequestIdForUpdate(parent.id);
        if (!enrollment) throw new Error("INVALID_STATUS_TRANSITION");

        const lockedPlan = await enrollments.findPlanForUpdate(enrollment.planId);
        try {
          enrollments.assertSnapshotMatchesPlan(enrollment, lockedPlan);
        } catch (error) {
          if (error instanceof Error && INCOMPATIBLE_ENROLLMENT_ERRORS.has(error.message)) {
            incompatibility = error.message;
          } else {
            throw error;
          }
        }
        const companyCnpjConflict = enrollment.companyCnpj
          ? await enrollments.companyCnpjIsInUse(enrollment.companyCnpj)
          : false;
        if (!incompatibility && companyCnpjConflict) incompatibility = "COMPANY_ALREADY_EXISTS";
      }

      // Pedidos aprovados só tomam a decisão após resolver todos os locks e leituras.
      const now = this.clock();
      if (now.getTime() >= parent.expiresAt.getTime()) {
        const expiration = new AccessRequestEntity(parent).transitionTo("EXPIRED", undefined, undefined, now);
        if (!await requests.transitionIfCurrent(parent.id, expiration)) {
          throw new Error("ACCESS_REQUEST_TRANSITION_CONFLICT");
        }
        return { kind: "EXPIRED" } as const;
      }

      if (parent.status === "APPROVED") {
        if (!incompatibility) throw new Error("INVALID_STATUS_TRANSITION");
        transitionReason = `ENROLLMENT_INVALIDATED: ${incompatibility}; ${invalidationReason}`;
      }

      const rejection = new AccessRequestEntity(parent).transitionTo(
        "REJECTED",
        actor,
        transitionReason,
        now,
      );
      if (!await requests.transitionIfCurrent(parent.id, rejection)) {
        throw new Error("ACCESS_REQUEST_TRANSITION_CONFLICT");
      }

      const rejected = await requests.findById(parent.id);
      if (!rejected) throw new Error("ACCESS_REQUEST_TRANSITION_CONFLICT");
      enrollment ??= await enrollments.findByAccessRequestIdForUpdate(parent.id);
      return { kind: "REJECTED", request: rejected, enrollment } as const;
    }));

    if (outcome.kind === "EXPIRED") throw new Error("ACCESS_REQUEST_EXPIRED");
    return { request: outcome.request, enrollment: outcome.enrollment };
  }
}

async function withSafeDecisionErrors<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof Error && SAFE_DECISION_ERRORS.has(error.message)) throw error;
    throw new Error("ACCESS_REQUEST_DECISION_PERSISTENCE_FAILED");
  }
}
