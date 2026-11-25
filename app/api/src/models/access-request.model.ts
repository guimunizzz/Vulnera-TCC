/**
 * Domínio da solicitação de acesso, separado de User e contratação.
 * Centraliza estados, normalização e preparação de transições; consumido pelos
 * repositories e pelos futuros services, sem emitir credenciais ou expor HTTP.
 */
import type {
  AccessRequest as PrismaAccessRequest,
  AccessRequestEnrollment as PrismaAccessRequestEnrollment,
  AccessRequestEvent,
  Plan as PrismaPlan,
} from "@prisma/client";
import type { UserRole } from "./user.model";

export type AccessRequest = PrismaAccessRequest;
export type AccessRequestEnrollment = PrismaAccessRequestEnrollment;
export type { AccessRequestEvent };

export const ACCESS_REQUEST_STATUSES = [
  "PENDING_EMAIL_VERIFICATION", "PENDING_REVIEW", "APPROVED", "REJECTED", "EXPIRED", "ACTIVATED",
] as const;
export type AccessRequestStatus = (typeof ACCESS_REQUEST_STATUSES)[number];

export const ACCESS_REQUEST_TRANSITIONS: Readonly<Record<AccessRequestStatus, readonly AccessRequestStatus[]>> = {
  PENDING_EMAIL_VERIFICATION: ["PENDING_REVIEW", "EXPIRED"],
  PENDING_REVIEW: ["APPROVED", "REJECTED", "EXPIRED"],
  APPROVED: ["ACTIVATED", "EXPIRED"],
  REJECTED: [],
  EXPIRED: [],
  ACTIVATED: [],
};

export const ACCESS_REQUEST_RESERVED_STATUSES = ["PENDING_EMAIL_VERIFICATION", "PENDING_REVIEW", "APPROVED"] as const;
const DAY_MS = 86_400_000;
export const ACCESS_REQUEST_LIFETIME_MS = {
  PENDING_EMAIL_VERIFICATION: 7 * DAY_MS,
  PENDING_REVIEW: 30 * DAY_MS,
  APPROVED: 7 * DAY_MS,
} as const;

export function accessRequestDeadline(status: keyof typeof ACCESS_REQUEST_LIFETIME_MS, now: Date): Date {
  return new Date(now.getTime() + ACCESS_REQUEST_LIFETIME_MS[status]);
}

/** Política do novo domínio: caixa baixa e trim; preserva pontos e aliases +. */
export function normalizeAccessRequestEmail(email: string): string {
  return email.trim().toLowerCase();
}

export type CreateAccessRequestDTO = {
  name: string;
  email: string;
  companyName: string;
  phone?: string | null;
};

/** Adesão pública nova: dados pessoais mais uma oferta selecionada do catálogo. */
export type CreateAccessRequestEnrollmentDTO = CreateAccessRequestDTO & {
  companyCnpj?: string | null;
  planId: string;
};

/** O snapshot permanece vinculado ao plano selecionado e não aceita trocas administrativas. */
export function matchesAccessRequestPlanSnapshot(
  enrollment: Pick<
    AccessRequestEnrollment,
    | "planId"
    | "planName"
    | "planPrice"
    | "planMaxApplications"
    | "planMaxProjects"
    | "planIncludesRemediation"
  >,
  plan: PrismaPlan,
): boolean {
  return plan.id === enrollment.planId
    && plan.name === enrollment.planName
    && plan.price.equals(enrollment.planPrice)
    && plan.maxApplications === enrollment.planMaxApplications
    && plan.maxProjects === enrollment.planMaxProjects
    && plan.includesRemediation === enrollment.planIncludesRemediation;
}

/** DTO interno produzido pela entidade; não aceitar este objeto de um body HTTP. */
export type AccessRequestTransitionDTO = {
  fromStatus: AccessRequestStatus;
  toStatus: AccessRequestStatus;
  actorId: string | null;
  reason: string | null;
  occurredAt: Date;
  expectedExpiresAt: Date;
  expiresAt: Date;
};

export class AccessRequestEntity {
  constructor(private readonly data: AccessRequest) {}

  transitionTo(
    toStatus: AccessRequestStatus,
    actor?: { userId: string; role: UserRole },
    reason?: string,
    now: Date = new Date(),
  ): AccessRequestTransitionDTO {
    const fromStatus = this.data.status as AccessRequestStatus;
    const approvalInvalidation = fromStatus === "APPROVED"
      && toStatus === "REJECTED"
      && Boolean(reason?.trim());
    if (!ACCESS_REQUEST_TRANSITIONS[fromStatus]?.includes(toStatus) && !approvalInvalidation) {
      throw new Error("INVALID_STATUS_TRANSITION");
    }
    if (toStatus === "EXPIRED") {
      if (now.getTime() < this.data.expiresAt.getTime()) throw new Error("ACCESS_REQUEST_NOT_EXPIRED");
    } else if (now.getTime() >= this.data.expiresAt.getTime()) {
      throw new Error("ACCESS_REQUEST_EXPIRED");
    }
    const review = toStatus === "APPROVED" || toStatus === "REJECTED";
    if (review && (!actor || actor.role !== "ADMIN")) throw new Error("FORBIDDEN");
    return {
      fromStatus, toStatus, occurredAt: now,
      expectedExpiresAt: this.data.expiresAt,
      expiresAt: toStatus === "PENDING_REVIEW" || toStatus === "APPROVED"
        ? accessRequestDeadline(toStatus, now) : this.data.expiresAt,
      actorId: review ? actor!.userId : null,
      reason: toStatus === "REJECTED" ? reason?.trim() || null : null,
    };
  }
}
