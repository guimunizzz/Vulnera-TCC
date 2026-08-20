/**
 * subscription.service.ts
 *
 * Regra de negócio de Subscription. A REGRA DE OURO — só pode existir 1
 * subscription ACTIVE por company — é validada AQUI, duas vezes: uma no
 * request() (pra não deixar o usuário nem tentar) e outra no approve()
 * (porque o estado da company pode ter mudado entre o request e a
 * aprovação do admin — outra subscription pode ter sido aprovada nesse meio
 * tempo).
 *
 * Toda transição de estado grava um AuditLog (append-only) via
 * AuditLogRepository.
 */

import type { SubscriptionRepository } from "../repositories/subscription.repository";
import type { PlanRepository } from "../repositories/plan.repository";
import type { UserRepository } from "../repositories/user.repository";
import type { AuditLogRepository } from "../repositories/audit-log.repository";
import { SubscriptionEntity, type CreateSubscriptionDTO } from "../models/subscription.model";
import type { UserRole } from "../models/user.model";

interface Actor {
  userId: string;
  role: UserRole;
}

export class SubscriptionService {
  constructor(
    private readonly repository: SubscriptionRepository,
    private readonly planRepository: PlanRepository,
    private readonly userRepository: UserRepository,
    private readonly auditLogRepository: AuditLogRepository,
  ) {}

  async request(actor: Actor, dto: CreateSubscriptionDTO): Promise<SubscriptionEntity> {
    const user = await this.userRepository.findById(actor.userId);
    if (!user?.companyId) throw new Error("USER_HAS_NO_COMPANY");

    const plan = await this.planRepository.findById(dto.planId);
    if (!plan) throw new Error("PLAN_NOT_FOUND");

    const active = await this.repository.findActiveByCompany(user.companyId);
    if (active) throw new Error("ALREADY_HAS_ACTIVE_SUBSCRIPTION");

    const created = await this.repository.create({ companyId: user.companyId, planId: dto.planId });

    await this.auditLogRepository.create({
      actorId: actor.userId,
      companyId: user.companyId,
      entityType: "Subscription",
      entityId: created.id,
      action: "SUBSCRIPTION_REQUESTED",
    });

    return new SubscriptionEntity(created);
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

  async approve(adminUserId: string, id: string): Promise<SubscriptionEntity> {
    const subscription = await this.repository.findById(id);
    if (!subscription) throw new Error("SUBSCRIPTION_NOT_FOUND");
    if (subscription.status !== "PENDING_APPROVAL") {
      throw new Error("INVALID_STATUS_TRANSITION");
    }

    // Revalida a regra de ouro: outra subscription pode ter virado ACTIVE
    // entre o request original e esta aprovação.
    const active = await this.repository.findActiveByCompany(subscription.companyId);
    if (active) throw new Error("ALREADY_HAS_ACTIVE_SUBSCRIPTION");

    const updated = await this.repository.approve(id, adminUserId);

    await this.auditLogRepository.create({
      actorId: adminUserId,
      companyId: subscription.companyId,
      entityType: "Subscription",
      entityId: id,
      action: "SUBSCRIPTION_APPROVED",
    });

    return new SubscriptionEntity(updated);
  }

  async reject(adminUserId: string, id: string): Promise<SubscriptionEntity> {
    const subscription = await this.repository.findById(id);
    if (!subscription) throw new Error("SUBSCRIPTION_NOT_FOUND");
    if (subscription.status !== "PENDING_APPROVAL") {
      throw new Error("INVALID_STATUS_TRANSITION");
    }

    const updated = await this.repository.reject(id, adminUserId);

    await this.auditLogRepository.create({
      actorId: adminUserId,
      companyId: subscription.companyId,
      entityType: "Subscription",
      entityId: id,
      action: "SUBSCRIPTION_REJECTED",
    });

    return new SubscriptionEntity(updated);
  }
}
