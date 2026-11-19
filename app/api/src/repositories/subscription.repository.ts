/**
 * subscription.repository.ts
 *
 * Acesso a dados de Subscription. Sem decisão de HTTP: além dos finders, este
 * repository serializa pedidos pelo registro Company para que a regra de
 * apenas uma ACTIVE e a retomada idempotente sejam atômicas no banco.
 */

import type { PrismaClient } from "@prisma/client";
import type { Subscription } from "../models/subscription.model";

export class SubscriptionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Subscription | null> {
    return this.prisma.subscription.findUnique({ where: { id } });
  }

  async findPending(): Promise<Subscription[]> {
    return this.prisma.subscription.findMany({
      where: { status: "PENDING_APPROVAL" },
      orderBy: { createdAt: "asc" },
    });
  }

  /** Usado pelo dashboard admin — "quantas empresas têm assinatura ativa agora". */
  async findAllActive(): Promise<Subscription[]> {
    return this.prisma.subscription.findMany({
      where: { status: "ACTIVE" },
      orderBy: { startDate: "desc" },
    });
  }

  async findActiveByCompany(companyId: string): Promise<Subscription | null> {
    return this.prisma.subscription.findFirst({
      where: { companyId, status: "ACTIVE" },
    });
  }

  async findPendingByCompany(companyId: string): Promise<Subscription | null> {
    return this.prisma.subscription.findFirst({
      where: { companyId, status: "PENDING_APPROVAL" },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
  }

  /**
   * Serializa solicitações pelo registro Company. A repetição do mesmo plano
   * devolve a solicitação existente; outro plano aguarda uma decisão explícita
   * sobre a pendência atual. A nova assinatura e seu evento são atômicos.
   */
  async requestPendingByCompany(data: {
    companyId: string;
    planId: string;
    actorId: string;
  }): Promise<Subscription> {
    return this.prisma.$transaction(async (tx) => {
      const companyRows = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM Company WHERE id = ${data.companyId} FOR UPDATE
      `;
      if (companyRows.length === 0) throw new Error("USER_HAS_NO_COMPANY");

      const active = await tx.subscription.findFirst({
        where: { companyId: data.companyId, status: "ACTIVE" },
      });
      if (active) throw new Error("ALREADY_HAS_ACTIVE_SUBSCRIPTION");

      const pending = await tx.subscription.findFirst({
        where: { companyId: data.companyId, status: "PENDING_APPROVAL" },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });
      if (pending) {
        if (pending.planId !== data.planId) {
          throw new Error("SUBSCRIPTION_REQUEST_ALREADY_PENDING");
        }
        return pending;
      }

      const subscription = await tx.subscription.create({
        data: {
          companyId: data.companyId,
          planId: data.planId,
          status: "PENDING_APPROVAL",
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: data.actorId,
          companyId: data.companyId,
          entityType: "Subscription",
          entityId: subscription.id,
          action: "SUBSCRIPTION_REQUESTED",
        },
      });

      return subscription;
    });
  }

  async approve(id: string, approvedBy: string): Promise<Subscription> {
    return this.prisma.subscription.update({
      where: { id },
      data: { status: "ACTIVE", startDate: new Date(), approvedBy },
    });
  }

  async reject(id: string, rejectedBy: string): Promise<Subscription> {
    return this.prisma.subscription.update({
      where: { id },
      data: { status: "REJECTED", approvedBy: rejectedBy },
    });
  }
}
