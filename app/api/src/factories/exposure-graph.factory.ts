// app/api/src/factories/exposure-graph.factory.ts
//
// FACTORY METHOD para o recurso Exposure Graph (padrão GoF, CLAUDE.md §4 A1).
//
// Depende de dois repositories. `ExposureGraphRepository` faz as consultas e
// `UserRepository` resolve a company do ator no banco. Sem a factory, a rota
// precisaria montar essa árvore à mão, e o caminho mais curto seria buscar o
// companyId do token, que é justamente o furo de isolamento que o comparativo
// evita (ver metrics.service.ts).
//
// Convenção: arquivo `<recurso>.factory.ts`, função `make<Recurso>Controller`.
// Consumidor: `company.routes.ts` (GET /me/exposure-graph).

import { prisma } from "../database/prisma.database";
import { ExposureGraphRepository } from "../repositories/exposure-graph.repository";
import { UserRepository } from "../repositories/user.repository";
import { ExposureGraphService } from "../services/exposure-graph.service";
import { ExposureGraphController } from "../controllers/exposure-graph.controller";

export function makeExposureGraphController(): ExposureGraphController {
  const repository = new ExposureGraphRepository(prisma);
  const userRepository = new UserRepository(prisma);

  const service = new ExposureGraphService(repository, userRepository);

  return new ExposureGraphController(service);
}
