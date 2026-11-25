// app/api/src/factories/admin-queues.factory.ts
//
// FACTORY METHOD do painel de filas do ADMIN (ADR-056). Monta
// Repository -> Service -> Controller num único ponto. A fila vem de
// `makeJobQueue()` (singleton por processo), o mesmo motor que o resto do produto usa.

import { prisma } from "../database/prisma.database";
import { AuditLogRepository } from "../repositories/audit-log.repository";
import { QueueAdminService } from "../services/queue-admin.service";
import { AdminQueuesController } from "../controllers/admin-queues.controller";
import { makeJobQueue } from "./job-queue.factory";

export function makeQueueAdminService(): QueueAdminService {
  return new QueueAdminService(makeJobQueue(), new AuditLogRepository(prisma));
}

export function makeAdminQueuesController(): AdminQueuesController {
  return new AdminQueuesController(makeQueueAdminService());
}
