// app/api/src/factories/subscription.factory.ts
//
// FACTORY METHOD para o recurso Subscription (padrão GoF).
// Subscription depende de 4 repositories (Subscription, Plan, User,
// AuditLog) — sem factory cada rota teria que montar essa árvore na mão.
// Esta factory esconde a montagem, centraliza a injeção do PrismaClient e
// permite uma factory-irmã de teste que injeta mock.
//
// Convenção: arquivo `<recurso>.factory.ts`, função `make<Recurso>Controller`.
// Consumidor: APENAS o arquivo de routes do recurso.

import { prisma } from "../database/prisma.database";
import { SubscriptionRepository } from "../repositories/subscription.repository";
import { PlanRepository } from "../repositories/plan.repository";
import { UserRepository } from "../repositories/user.repository";
import { AuditLogRepository } from "../repositories/audit-log.repository";
import { SubscriptionService } from "../services/subscription.service";
import { SubscriptionController } from "../controllers/subscription.controller";

export function makeSubscriptionController(): SubscriptionController {
  const repository = new SubscriptionRepository(prisma);
  const planRepository = new PlanRepository(prisma);
  const userRepository = new UserRepository(prisma);
  const auditLogRepository = new AuditLogRepository(prisma);
  const service = new SubscriptionService(repository, planRepository, userRepository, auditLogRepository);
  return new SubscriptionController(service);
}
