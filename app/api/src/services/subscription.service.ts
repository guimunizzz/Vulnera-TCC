/**
 * subscription.service.ts
 *
 * Regra de negócio de Subscription. A REGRA DE OURO — só pode existir 1
 * subscription ACTIVE por company — é verificada no request() sob lock da
 * company e revalidada no approve() (o estado pode mudar entre as operações).
 *
 * Toda transição grava seu AuditLog na mesma transação da assinatura.
 */

import type { SubscriptionRepository } from "../repositories/subscription.repository";
import type { UserRepository } from "../repositories/user.repository";
import { SubscriptionEntity, type CreateSubscriptionDTO } from "../models/subscription.model";
import type { UserRole } from "../models/user.model";

interface Actor {
  userId: string;
  role: UserRole;
}

export class SubscriptionService {
  constructor(
    private readonly repository: SubscriptionRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async request(actor: Actor, dto: CreateSubscriptionDTO): Promise<SubscriptionEntity> {
    if (actor.role !== "CLIENT") throw new Error("FORBIDDEN");
    const user = await this.userRepository.findById(actor.userId);
    if (!user || user.deactivatedAt || user.role !== "CLIENT") throw new Error("FORBIDDEN");
    if (!user.companyId) throw new Error("USER_HAS_NO_COMPANY");
    if (user.companyRole !== "OWNER") throw new Error("FORBIDDEN");

    const subscription = await this.repository.requestPendingByCompany({
      companyId: user.companyId,
      planId: dto.planId,
      actorId: actor.userId,
    });

    return new SubscriptionEntity(subscription);
  }

  async listPending(): Promise<SubscriptionEntity[]> {
    const pending = await this.repository.findPending();
    return pending.map((s) => new SubscriptionEntity(s));
  }

  /** Dashboard admin (Fase 6) — companies com assinatura ACTIVE agora (1 subscription ACTIVE por company, ver regra de ouro). */
  async listActive(): Promise<SubscriptionEntity[]> {
    const active = await this.repository.findAllActive();
    return active.map((s) => new SubscriptionEntity(s));
  }

  async getCurrent(actor: Actor): Promise<SubscriptionEntity> {
    const user = await this.userRepository.findById(actor.userId);
    if (!user?.companyId) throw new Error("USER_HAS_NO_COMPANY");

    const active = await this.repository.findActiveByCompany(user.companyId);
    if (!active) throw new Error("SUBSCRIPTION_NOT_FOUND");

    return new SubscriptionEntity(active);
  }

  /**
   * Estado mínimo para retomar o onboarding do OWNER. Mantém /current como
   * ACTIVE-only e deriva a empresa do usuário autenticado.
   */
  async getOnboardingStatus(actor: Actor): Promise<{
    status: "NEEDS_ONBOARDING" | "PENDING_APPROVAL" | "ACTIVE";
    subscription: SubscriptionEntity | null;
  }> {
    if (actor.role !== "CLIENT") throw new Error("FORBIDDEN");
    const user = await this.userRepository.findById(actor.userId);
    if (!user?.companyId) throw new Error("USER_HAS_NO_COMPANY");
    if (user.role !== "CLIENT" || user.companyRole !== "OWNER") throw new Error("FORBIDDEN");

    const active = await this.repository.findActiveByCompany(user.companyId);
    if (active) {
      return { status: "ACTIVE", subscription: new SubscriptionEntity(active) };
    }

    const pending = await this.repository.findPendingByCompany(user.companyId);
    if (pending) {
      return { status: "PENDING_APPROVAL", subscription: new SubscriptionEntity(pending) };
    }

    return { status: "NEEDS_ONBOARDING", subscription: null };
  }

  async approve(adminUserId: string, id: string): Promise<SubscriptionEntity> {
    return new SubscriptionEntity(await this.repository.decide(id, adminUserId, "ACTIVE"));
  }

  async reject(adminUserId: string, id: string): Promise<SubscriptionEntity> {
    return new SubscriptionEntity(await this.repository.decide(id, adminUserId, "REJECTED"));
  }
}
