// app/api/src/factories/plan.factory.ts
//
// FACTORY METHOD para o recurso Plan
// ----------------------------------------------------------------------------
// PADRÃO: Factory Method (GoF)
//
// PROBLEMA QUE RESOLVE:
//   Sem factory, a rota teria que fazer:
//     const repository = new PlanRepository(prisma);
//     const service = new PlanService(repository);
//     const controller = new PlanController(service);
//   Isso (1) embola responsabilidades (rota não monta dependências),
//   (2) repete código toda rota nova e (3) torna mock pra teste difícil.
//
// COMO RESOLVE:
//   1. Esconde complexidade de montagem (encapsulamento)
//   2. Centraliza injeção do PrismaClient
//   3. Permite factory irmã pra teste com mock
//
// CONVENÇÕES:
//   - Nome do arquivo: `<recurso>.factory.ts`
//   - Nome da função:  `make<Recurso>Controller`
//   - Quem consome:    APENAS o arquivo de routes do recurso
// ----------------------------------------------------------------------------

import { prisma } from "../database/prisma.database";
import { PlanRepository } from "../repositories/plan.repository";
import { PlanService } from "../services/plan.service";
import { PlanController } from "../controllers/plan.controller";

export function makePlanController(): PlanController {
  // Ordem: mais interno (Repository) → mais externo (Controller)
  const repository = new PlanRepository(prisma);
  const service = new PlanService(repository);
  const controller = new PlanController(service);
  return controller;
}
