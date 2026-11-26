// app/api/src/factories/exposure-analysis.factory.ts
//
// FACTORY METHOD para as análises do Exposure Graph (ADR-061), mesmo padrão
// do `exposure-graph.factory.ts`: o service reaproveita o repository do grafo
// (aplicações ativas) e resolve a company pelo `UserRepository`, nunca pelo
// token.
//
// Consumidor: `company.routes.ts` (GET /me/exposure-graph/...).

import { prisma } from "../database/prisma.database";
import { ExposureAnalysisRepository } from "../repositories/exposure-analysis.repository";
import { ExposureGraphRepository } from "../repositories/exposure-graph.repository";
import { UserRepository } from "../repositories/user.repository";
import { ExposureAnalysisService } from "../services/exposure-analysis.service";
import { ExposureAnalysisController } from "../controllers/exposure-analysis.controller";

export function makeExposureAnalysisController(): ExposureAnalysisController {
  const service = new ExposureAnalysisService(
    new ExposureAnalysisRepository(prisma),
    new ExposureGraphRepository(prisma),
    new UserRepository(prisma),
  );
  return new ExposureAnalysisController(service);
}
