// app/api/src/factories/subscription.factory.ts
//
// FACTORY METHOD para o recurso Subscription (padrão GoF).
// A factory injeta os repositórios da assinatura e da identidade do solicitante.
// Esta factory esconde a montagem, centraliza a injeção do PrismaClient e
// permite uma factory-irmã de teste que injeta mock.
//
// Convenção: arquivo `<recurso>.factory.ts`, função `make<Recurso>Controller`.
// Consumidor: APENAS o arquivo de routes do recurso.

import { prisma } from "../database/prisma.database";
import { SubscriptionRepository } from "../repositories/subscription.repository";
import { UserRepository } from "../repositories/user.repository";
import { SubscriptionService } from "../services/subscription.service";
import { SubscriptionController } from "../controllers/subscription.controller";

export function makeSubscriptionController(): SubscriptionController {
  const repository = new SubscriptionRepository(prisma);
  const userRepository = new UserRepository(prisma);
  const service = new SubscriptionService(repository, userRepository);
  return new SubscriptionController(service);
}
