/**
 * subscriptions.fixture.ts
 *
 * Helper para criar subscriptions direto no banco de teste (bypass da API).
 * Útil pra montar cenários de "company já tem ACTIVE" sem passar pelo fluxo
 * completo de request + approve.
 */

import { prisma } from "../../src/database/prisma.database";
import type { Subscription } from "@prisma/client";

export interface SeedSubscriptionInput {
  companyId: string;
  planId: string;
  status?: string;
  startDate?: Date | null;
  approvedBy?: string | null;
}

export async function seedSubscription(input: SeedSubscriptionInput): Promise<Subscription> {
  return prisma.subscription.create({
    data: {
      companyId: input.companyId,
      planId: input.planId,
      status: input.status ?? "PENDING_APPROVAL",
      startDate: input.startDate ?? null,
      approvedBy: input.approvedBy ?? null,
    },
  });
}
