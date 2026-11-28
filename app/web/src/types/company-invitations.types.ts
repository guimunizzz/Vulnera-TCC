/** DTOs públicos e autenticados do ciclo de convite para membros de empresa. */
export type CompanyInvitationStatus = "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";

export interface CompanyTeam {
  company: { id: string; name: string };
  members: Array<{ id: string; name: string; companyRole: "OWNER" | "MEMBER" }>;
}

export interface CompanyMember {
  id: string;
  name: string;
  email: string;
  companyRole: "OWNER" | "MEMBER";
  createdAt: string;
}

export interface CompanyInvitation {
  id: string;
  name: string;
  email: string;
  status: CompanyInvitationStatus;
  issuedAt: string;
  expiresAt: string;
}

export interface CompanyInvitationHistoryEvent {
  id: string;
  invitationId: string;
  action: string;
  email: string | null;
  actorName: string;
  createdAt: string;
}

export interface CompanyInvitationMutationResult {
  invitation: CompanyInvitation;
  delivery: "SENT" | "DELIVERY_FAILED";
}
