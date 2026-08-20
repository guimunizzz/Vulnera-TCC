/**
 * subscription.model.ts
 *
 * Tipos, DTOs e Entity do domínio Subscription — vínculo Company ↔ Plan.
 * status real vem do schema.prisma: PENDING_APPROVAL | ACTIVE | REJECTED |
 * SUSPENDED | CANCELED (default PENDING_APPROVAL — não "PENDING").
 *
 * CreateSubscriptionDTO só carrega planId: companyId NUNCA vem do body
 * (anti-pattern do CLAUDE.md §14) — o service deriva da company do
 * próprio usuário autenticado.
 */

import type { Subscription as PrismaSubscription } from "@prisma/client";

export type Subscription = PrismaSubscription;

export type SubscriptionStatus =
  | "PENDING_APPROVAL"
  | "ACTIVE"
  | "REJECTED"
  | "SUSPENDED"
  | "CANCELED";

export type CreateSubscriptionDTO = {
  planId: string;
};

export type SubscriptionResponseDTO = {
  id: string;
  companyId: string;
  planId: string;
  status: SubscriptionStatus;
  startDate: string | null;
  endDate: string | null;
  approvedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export class SubscriptionEntity {
  constructor(private readonly data: Subscription) {}

  toResponse(): SubscriptionResponseDTO {
    return {
      id: this.data.id,
      companyId: this.data.companyId,
      planId: this.data.planId,
      status: this.data.status as SubscriptionStatus,
      startDate: this.data.startDate ? this.data.startDate.toISOString() : null,
      endDate: this.data.endDate ? this.data.endDate.toISOString() : null,
      approvedBy: this.data.approvedBy,
      createdAt: this.data.createdAt.toISOString(),
      updatedAt: this.data.updatedAt.toISOString(),
    };
  }
}
