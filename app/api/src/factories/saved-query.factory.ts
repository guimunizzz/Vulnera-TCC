/**
 * saved-query.factory.ts
 *
 * FACTORY METHOD (GoF) das buscas salvas / watchlists — CP-6.
 * Monta Repository -> Service -> Controller e devolve o controller pronto.
 * Único consumidor: routes/saved-query.routes.ts.
 */

import { prisma } from "../database/prisma.database";
import { SavedQueryRepository } from "../repositories/saved-query.repository";
import { UserRepository } from "../repositories/user.repository";
import { SavedQueryService } from "../services/saved-query.service";
import { SavedQueryController } from "../controllers/saved-query.controller";

export function makeSavedQueryController(): SavedQueryController {
  return new SavedQueryController(
    new SavedQueryService(new SavedQueryRepository(prisma), new UserRepository(prisma)),
  );
}
