export type SubscriptionStatus = "PENDING_APPROVAL" | "ACTIVE" | "REJECTED" | "SUSPENDED" | "CANCELED";

export interface Subscription {
  id: string;
  companyId: string;
  planId: string;
  status: SubscriptionStatus;
  startDate: string | null;
  endDate: string | null;
  approvedBy: string | null;
  createdAt: string;
  updatedAt: string;
}
