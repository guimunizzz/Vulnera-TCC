// app/api/src/factories/application.factory.ts
//
// FACTORY METHOD para o recurso Application (padrão GoF).
// Depende de UserRepository (resolver companyId do actor), SubscriptionRepository
// e PlanRepository (gate RN03/RN07 — assinatura ativa + limite do plano).
//
// Convenção: arquivo `<recurso>.factory.ts`, função `make<Recurso>Controller`.
// Consumidor: APENAS o arquivo de routes do recurso.

import { prisma } from "../database/prisma.database";
import { ApplicationRepository } from "../repositories/application.repository";
import { UserRepository } from "../repositories/user.repository";
import { SubscriptionRepository } from "../repositories/subscription.repository";
import { PlanRepository } from "../repositories/plan.repository";
import { ApplicationService } from "../services/application.service";
import { ApplicationController } from "../controllers/application.controller";

export function makeApplicationController(): ApplicationController {
  const repository = new ApplicationRepository(prisma);
  const userRepository = new UserRepository(prisma);
  const subscriptionRepository = new SubscriptionRepository(prisma);
  const planRepository = new PlanRepository(prisma);
  const service = new ApplicationService(repository, userRepository, subscriptionRepository, planRepository);
  return new ApplicationController(service);
}
