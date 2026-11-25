/**
 * Define o ator e as respostas seguras da fila administrativa de acesso.
 * Existe para manter tokens e campos internos fora da API; é consumido pelos
 * repositories de leitura, services administrativos e controllers.
 */

import type { AccessInvitation as PrismaAccessInvitation } from "@prisma/client";
import type { AccessRequest as PrismaAccessRequest, AccessRequestEvent as PrismaAccessRequestEvent } from "@prisma/client";
import type { AccessRequestStatus } from "./access-request.model";
import type { UserRole } from "./user.model";

export type AccessRequestAdminActor = {
  userId: string;
  role: UserRole;
};

export type AdminAccessRequestRaw = Pick<
  PrismaAccessRequest,
  | "id"
  | "name"
  | "email"
  | "companyName"
  | "phone"
  | "status"
  | "expiresAt"
  | "emailVerifiedAt"
  | "reviewedAt"
  | "reviewedById"
  | "rejectionReason"
  | "createdAt"
  | "updatedAt"
> & {
  invitation?: Pick<PrismaAccessInvitation, "issuedAt" | "expiresAt" | "usedAt" | "revokedAt"> | null;
};

export type AdminAccessRequestEventRaw = Pick<
  PrismaAccessRequestEvent,
  "id" | "eventType" | "actorId" | "fromStatus" | "toStatus" | "reason" | "createdAt"
>;

export type AdminAccessRequestResponseDTO = {
  id: string;
  name: string;
  email: string;
  companyName: string;
  phone: string | null;
  status: AccessRequestStatus;
  expiresAt: string;
  emailVerifiedAt: string | null;
  reviewedAt: string | null;
  reviewedById: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminAccessRequestInvitationDTO = {
  issuedAt: string;
  expiresAt: string;
  usedAt: string | null;
  revokedAt: string | null;
};

export type AdminAccessRequestDetailDTO = AdminAccessRequestResponseDTO & {
  invitation: AdminAccessRequestInvitationDTO | null;
};

export type AdminAccessRequestEventDTO = {
  id: string;
  eventType: string;
  actorId: string | null;
  fromStatus: string | null;
  toStatus: string;
  reason: string | null;
  createdAt: string;
};

export type AdminAccessRequestPageDTO = {
  items: AdminAccessRequestResponseDTO[];
  total: number;
  page: number;
  pageSize: number;
};

export type AdminAccessRequestEventsPageDTO = {
  items: AdminAccessRequestEventDTO[];
  total: number;
  page: number;
  pageSize: number;
};

export class AdminAccessRequestEntity {
  constructor(private readonly data: AdminAccessRequestRaw) {}

  toResponse(): AdminAccessRequestResponseDTO {
    return {
      id: this.data.id,
      name: this.data.name,
      email: this.data.email,
      companyName: this.data.companyName,
      phone: this.data.phone,
      status: this.data.status as AccessRequestStatus,
      expiresAt: this.data.expiresAt.toISOString(),
      emailVerifiedAt: this.data.emailVerifiedAt?.toISOString() ?? null,
      reviewedAt: this.data.reviewedAt?.toISOString() ?? null,
      reviewedById: this.data.reviewedById,
      rejectionReason: this.data.rejectionReason,
      createdAt: this.data.createdAt.toISOString(),
      updatedAt: this.data.updatedAt.toISOString(),
    };
  }

  toDetailResponse(): AdminAccessRequestDetailDTO {
    const invitation = this.data.invitation;
    return {
      ...this.toResponse(),
      invitation: invitation ? {
        issuedAt: invitation.issuedAt.toISOString(),
        expiresAt: invitation.expiresAt.toISOString(),
        usedAt: invitation.usedAt?.toISOString() ?? null,
        revokedAt: invitation.revokedAt?.toISOString() ?? null,
      } : null,
    };
  }
}

export function adminAccessRequestEventToResponse(event: AdminAccessRequestEventRaw): AdminAccessRequestEventDTO {
  return {
    id: event.id,
    eventType: event.eventType,
    actorId: event.actorId,
    fromStatus: event.fromStatus,
    toStatus: event.toStatus,
    reason: event.reason,
    createdAt: event.createdAt.toISOString(),
  };
}
