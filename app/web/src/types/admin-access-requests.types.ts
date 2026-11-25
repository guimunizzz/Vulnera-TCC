/**
 * O que faz: declara os DTOs seguros da fila administrativa de acesso.
 * Por que existe: mantém alinhados os tipos de paginação, histórico e ações com a API.
 * Quem consome: admin-access-requests.api.ts e AccessRequestsPage.
 */
export const ADMIN_ACCESS_REQUEST_STATUSES = [
  "PENDING_EMAIL_VERIFICATION",
  "PENDING_REVIEW",
  "APPROVED",
  "REJECTED",
  "EXPIRED",
  "ACTIVATED",
] as const;

export type AdminAccessRequestStatus = (typeof ADMIN_ACCESS_REQUEST_STATUSES)[number];

export interface AdminAccessRequest {
  id: string;
  name: string;
  email: string;
  companyName: string;
  phone: string | null;
  status: AdminAccessRequestStatus;
  expiresAt: string;
  emailVerifiedAt: string | null;
  reviewedAt: string | null;
  reviewedById: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminAccessRequestDetail extends AdminAccessRequest {
  invitation: {
    issuedAt: string;
    expiresAt: string;
    usedAt: string | null;
    revokedAt: string | null;
  } | null;
}

export interface AdminAccessRequestEvent {
  id: string;
  eventType: string;
  actorId: string | null;
  fromStatus: string | null;
  toStatus: string;
  reason: string | null;
  createdAt: string;
}

export interface AdminAccessRequestPage {
  items: AdminAccessRequest[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminAccessRequestEventsPage {
  items: AdminAccessRequestEvent[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminAccessRequestMutationResult {
  request: AdminAccessRequest;
  invitationDelivery: "SENT" | "DELIVERY_FAILED";
}
