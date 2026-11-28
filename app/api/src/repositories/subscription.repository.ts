/**
 * subscription.repository.ts
 *
 * Acesso a dados de Subscription. Sem decisão de HTTP: além dos finders, este
 * repository serializa pedidos pelo registro Company para que a regra de
 * apenas uma ACTIVE e a retomada idempotente sejam atômicas no banco.
 */

import type { PrismaClient } from "@prisma/client";
import type { Subscription } from "../models/subscription.model";
import { lockEligiblePlan } from "./plan.repository";
import { TenantLockRepository } from "./tenant-lock.repository";

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
      const locks = new TenantLockRepository(tx);
      const company = await locks.lockCompany(data.companyId);
      if (!company) throw new Error("USER_HAS_NO_COMPANY");
      await locks.lockUsers([data.actorId]);
      const actor = await tx.user.findUnique({ where: { id: data.actorId } });
      if (!actor || actor.deactivatedAt || actor.role !== "CLIENT"
        || actor.companyRole !== "OWNER" || actor.companyId !== data.companyId) {
        throw new Error("FORBIDDEN");
      }

      const active = await tx.subscription.findFirst({
        where: { companyId: data.companyId, status: "ACTIVE" },
      });
      if (active) throw new Error("ALREADY_HAS_ACTIVE_SUBSCRIPTION");
      await lockEligiblePlan(tx, data.planId);

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
    }, { isolationLevel: "ReadCommitted" });
  }

  async decide(id: string, actorId: string, decision: "ACTIVE" | "REJECTED"): Promise<Subscription> {
    return this.prisma.$transaction(async (tx) => {
      const locks = new TenantLockRepository(tx);
      const target = await tx.subscription.findUnique({ where: { id }, select: { companyId: true } });
      if (!target || !await locks.lockCompany(target.companyId)) throw new Error("SUBSCRIPTION_NOT_FOUND");
      await locks.lockUsers([actorId]);
      const actor = await tx.user.findUnique({ where: { id: actorId } });
      if (!actor || actor.role !== "ADMIN" || actor.deactivatedAt) throw new Error("FORBIDDEN");

      const current = await tx.subscription.findUnique({ where: { id } });
      if (!current) throw new Error("SUBSCRIPTION_NOT_FOUND");
      if (current.status !== "PENDING_APPROVAL") throw new Error("INVALID_STATUS_TRANSITION");

      if (decision === "ACTIVE") {
        const active = await tx.subscription.findFirst({
          where: { companyId: current.companyId, status: "ACTIVE" },
        });
        if (active) throw new Error("ALREADY_HAS_ACTIVE_SUBSCRIPTION");
        await lockEligiblePlan(tx, current.planId);
      }

      const updated = await tx.subscription.update({
        where: { id },
        data: { status: decision, approvedBy: actorId, startDate: decision === "ACTIVE" ? new Date() : undefined },
      });
      if (decision === "ACTIVE") {
        await tx.company.update({ where: { id: current.companyId }, data: { planId: current.planId } });
      }
      await tx.auditLog.create({
        data: {
          actorId, companyId: current.companyId, entityType: "Subscription", entityId: id,
          action: decision === "ACTIVE" ? "SUBSCRIPTION_APPROVED" : "SUBSCRIPTION_REJECTED",
        },
      });
      return updated;
    }, { isolationLevel: "ReadCommitted" });
  }
}
