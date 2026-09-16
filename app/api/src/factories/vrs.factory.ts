// app/api/src/factories/vrs.factory.ts
//
// FACTORY METHOD para o recálculo em lote do VRS (CP-3, padrão GoF).
// Só depende de VulnerabilityRepository. Não tem controller: o VRS não tem
// endpoint próprio — é coluna do finding, lida por GET /vulnerabilities.
//
// Consumidores: application.factory.ts (pluga no gancho de mudança de
// contexto) e prisma/backfill-vrs.ts.

import { prisma } from "../database/prisma.database";
import { VulnerabilityRepository } from "../repositories/vulnerability.repository";
import { VrsService } from "../services/vrs.service";

export function makeVrsService(): VrsService {
  return new VrsService(new VulnerabilityRepository(prisma));
}
