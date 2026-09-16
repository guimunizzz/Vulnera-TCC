// app/api/src/factories/application.factory.ts
//
// FACTORY METHOD para o recurso Application (padrão GoF).
// Depende de UserRepository (resolver companyId/companyRole do actor),
// SubscriptionRepository e PlanRepository (gate RN03/RN07 — assinatura ativa +
// limite do plano) e AuditLogRepository (RISK_CONTEXT_CHANGED, CP-1).
//
// Convenção: arquivo `<recurso>.factory.ts`, função `make<Recurso>Controller`.
// Consumidor: APENAS o arquivo de routes do recurso.

import { prisma } from "../database/prisma.database";
import { ApplicationRepository } from "../repositories/application.repository";
import { UserRepository } from "../repositories/user.repository";
import { SubscriptionRepository } from "../repositories/subscription.repository";
import { PlanRepository } from "../repositories/plan.repository";
import { AuditLogRepository } from "../repositories/audit-log.repository";
import { ApplicationService } from "../services/application.service";
import { ApplicationController } from "../controllers/application.controller";
import { makeVrsService } from "./vrs.factory";

export function makeApplicationController(): ApplicationController {
  const repository = new ApplicationRepository(prisma);
  const userRepository = new UserRepository(prisma);
  const subscriptionRepository = new SubscriptionRepository(prisma);
  const planRepository = new PlanRepository(prisma);
  const auditLogRepository = new AuditLogRepository(prisma);
  const service = new ApplicationService(
    repository,
    userRepository,
    subscriptionRepository,
    planRepository,
    auditLogRepository,
  );
  // VRS (CP-3): mudou o contexto de risco → recalcula o score de todos os
  // findings da app. O acoplamento Application → Vulnerability mora AQUI, num
  // gancho plugado pela factory, e não dentro do ApplicationService (P1).
  const vrsService = makeVrsService();
  service.setRiskContextChangedHook((application) => vrsService.recomputeForApplication(application));
  return new ApplicationController(service);
}
