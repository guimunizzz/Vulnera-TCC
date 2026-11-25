/**
 * Contratos de convite para membros de uma Company já existente.
 * O convite é independente do onboarding público; respostas nunca incluem hash,
 * email ativo ou token. Consumido pelo repository, service e controller.
 */
import type { CompanyInvitation as PrismaCompanyInvitation } from "@prisma/client";

export type CompanyInvitation = PrismaCompanyInvitation;

export const COMPANY_INVITATION_TTL_MS = 48 * 60 * 60 * 1_000;
export const COMPANY_INVITATION_RESEND_COOLDOWN_MS = 60 * 1_000;

export type CompanyInvitationStatus = "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";
export type CompanyInvitationDeliveryStatus = "SENT" | "DELIVERY_FAILED";

export type CreateCompanyInvitationDTO = {
  name: string;
  email: string;
};

export type CompanyInvitationResponseDTO = {
  id: string;
  name: string;
  email: string;
  status: CompanyInvitationStatus;
  issuedAt: string;
  expiresAt: string;
};

export type CompanyInvitationHistoryDTO = {
  id: string;
  invitationId: string;
  action: string;
  email: string | null;
  actorName: string;
  createdAt: string;
};

export type CompanyMemberResponseDTO = {
  id: string;
  name: string;
  email: string;
  companyRole: "OWNER" | "MEMBER";
  createdAt: string;
};

export type PreparedCompanyInvitation = {
  invitationId: string;
  companyId: string;
  companyName: string;
  issuerId: string;
  name: string;
  email: string;
  token: string;
  tokenHash: string;
  expiresAt: Date;
};

export class CompanyInvitationEntity {
  constructor(private readonly data: CompanyInvitation) {}

  toResponse(now: Date = new Date()): CompanyInvitationResponseDTO {
    return {
      id: this.data.id,
      name: this.data.name,
      email: this.data.email,
      status: invitationStatus(this.data, now),
      issuedAt: this.data.issuedAt.toISOString(),
      expiresAt: this.data.expiresAt.toISOString(),
    };
  }
}

export function invitationStatus(data: Pick<CompanyInvitation, "usedAt" | "revokedAt" | "expiresAt">, now: Date): CompanyInvitationStatus {
  if (data.usedAt) return "ACCEPTED";
  if (data.revokedAt) return "REVOKED";
  if (data.expiresAt.getTime() <= now.getTime()) return "EXPIRED";
  return "PENDING";
}
