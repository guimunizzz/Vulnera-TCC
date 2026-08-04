/**
 * application.service.ts
 *
 * Regra crítica (RN03 + RN07) no create(): a company precisa de uma
 * Subscription ACTIVE, e o número de applications ativas não pode estourar
 * plan.maxApplications. companyId nunca vem do DTO — é sempre resolvido a
 * partir do actor autenticado.
 */

import type { ApplicationRepository } from "../repositories/application.repository";
import type { UserRepository } from "../repositories/user.repository";
import type { SubscriptionRepository } from "../repositories/subscription.repository";
import type { PlanRepository } from "../repositories/plan.repository";
import { ApplicationEntity, type CreateApplicationDTO, type UpdateApplicationDTO } from "../models/application.model";
import type { Application } from "@prisma/client";
import type { UserRole } from "../models/user.model";

interface Actor {
  userId: string;
  role: UserRole;
}

export class ApplicationService {
  constructor(
    private readonly repository: ApplicationRepository,
    private readonly userRepository: UserRepository,
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly planRepository: PlanRepository,
  ) {}

  async list(actor: Actor): Promise<ApplicationEntity[]> {
    if (actor.role === "ADMIN") {
      return (await this.repository.findAll()).map((a) => new ApplicationEntity(a));
    }
    if (actor.role === "CLIENT") {
      const user = await this.userRepository.findById(actor.userId);
      if (!user?.companyId) return [];
      return (await this.repository.findByCompany(user.companyId)).map((a) => new ApplicationEntity(a));
    }
    // PENTESTER não gerencia applications diretamente nesta fase
    throw new Error("FORBIDDEN");
  }

  async getById(actor: Actor, id: string): Promise<ApplicationEntity> {
    const application = await this.repository.findById(id);
    if (!application) throw new Error("APPLICATION_NOT_FOUND");
    await this.assertCanAccess(actor, application);
    return new ApplicationEntity(application);
  }

  async create(actor: Actor, dto: CreateApplicationDTO): Promise<ApplicationEntity> {
    const user = await this.userRepository.findById(actor.userId);
    if (!user?.companyId) throw new Error("USER_HAS_NO_COMPANY");

    // RN07 — projeto (e por extensão, o catálogo pago de applications) exige assinatura ativa
    const activeSubscription = await this.subscriptionRepository.findActiveByCompany(user.companyId);
    if (!activeSubscription) throw new Error("NO_ACTIVE_SUBSCRIPTION");

    const plan = await this.planRepository.findById(activeSubscription.planId);
    if (!plan) throw new Error("PLAN_NOT_FOUND");

    // RN03 — limite de applications pelo plano ativo
    const count = await this.repository.countActiveByCompany(user.companyId);
    if (count >= plan.maxApplications) throw new Error("PLAN_LIMIT_REACHED");

    const created = await this.repository.create(user.companyId, dto);
    return new ApplicationEntity(created);
  }

  async update(actor: Actor, id: string, dto: UpdateApplicationDTO): Promise<ApplicationEntity> {
    const application = await this.repository.findById(id);
    if (!application) throw new Error("APPLICATION_NOT_FOUND");
    await this.assertCanAccess(actor, application);

    const updated = await this.repository.update(id, dto);
    return new ApplicationEntity(updated);
  }

  async delete(actor: Actor, id: string): Promise<void> {
    const application = await this.repository.findById(id);
    if (!application) throw new Error("APPLICATION_NOT_FOUND");
    await this.assertCanAccess(actor, application);
    await this.repository.deactivate(id);
  }

  /** RN16: ADMIN vê/edita qualquer uma; CLIENT só a da própria company. */
  private async assertCanAccess(actor: Actor, application: Application): Promise<void> {
    if (actor.role === "ADMIN") return;
    if (actor.role === "CLIENT") {
      const user = await this.userRepository.findById(actor.userId);
      if (user?.companyId && user.companyId === application.companyId) return;
    }
    throw new Error("FORBIDDEN");
  }
}
