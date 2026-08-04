/**
 * subscription.repository.ts
 *
 * Acesso a dados de Subscription. Sem regra de negócio aqui — a regra de
 * ouro (1 ACTIVE por company) é validada no service, este repository só
 * expõe os dois finders que ela precisa (findActiveByCompany) e o findPending
 * pra fila de aprovação do admin.
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

  async findActiveByCompany(companyId: string): Promise<Subscription | null> {
    return this.prisma.subscription.findFirst({
      where: { companyId, status: "ACTIVE" },
    });
  }

  async create(data: { companyId: string; planId: string }): Promise<Subscription> {
    return this.prisma.subscription.create({
      data: {
        companyId: data.companyId,
        planId: data.planId,
        status: "PENDING_APPROVAL",
      },
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
