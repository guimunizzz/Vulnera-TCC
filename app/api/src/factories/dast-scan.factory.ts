// app/api/src/factories/dast-scan.factory.ts
//
// FACTORY METHOD para o recurso DastScan (módulo DAST)
// ----------------------------------------------------------------------------
// Mesma ideia de plan.factory.ts: monta Repository -> Service -> Controller
// num único ponto, pra rotas nunca instanciarem a stack inline. `makeDastScanService()`
// é exportada à parte (além do controller) porque o watchdog em server.ts
// precisa só do service, sem controller/HTTP nenhum.
// ----------------------------------------------------------------------------

import { prisma } from "../database/prisma.database";
import { DastScanRepository } from "../repositories/dast-scan.repository";
import { DastFindingRepository } from "../repositories/dast-finding.repository";
import { AuditLogRepository } from "../repositories/audit-log.repository";
import { UserRepository } from "../repositories/user.repository";
import { DastScanService } from "../services/dast-scan.service";
import { DastScanController } from "../controllers/dast-scan.controller";

export function makeDastScanService(): DastScanService {
  const repository = new DastScanRepository(prisma);
  const findingRepository = new DastFindingRepository(prisma);
  const auditLogRepository = new AuditLogRepository(prisma);
  const userRepository = new UserRepository(prisma);
  return new DastScanService(repository, findingRepository, auditLogRepository, userRepository);
}

export function makeDastScanController(): DastScanController {
  const service = makeDastScanService();
  return new DastScanController(service);
}
