// app/api/src/factories/dast-schedule.factory.ts
//
// FACTORY METHOD da autorização de DAST e dos scans agendados (ADR-056 §6).
// Monta Repository -> Service -> Controller num único ponto. `makeDastScheduleService`
// é exportada à parte porque o worker (worker.ts) e o gancho de falha do scan
// (dast-scan.factory.ts) precisam do service sem HTTP.

import { prisma } from "../database/prisma.database";
import { ApplicationRepository } from "../repositories/application.repository";
import { ScanScheduleRepository } from "../repositories/scan-schedule.repository";
import { ProjectRepository } from "../repositories/project.repository";
import { ProjectMemberRepository } from "../repositories/project-member.repository";
import { UserRepository } from "../repositories/user.repository";
import { AuditLogRepository } from "../repositories/audit-log.repository";
import { NotificationRepository } from "../repositories/notification.repository";
import { DastScanRepository } from "../repositories/dast-scan.repository";
import { DastFindingRepository } from "../repositories/dast-finding.repository";
import { DastScheduleService } from "../services/dast-schedule.service";
import { DastScheduleController } from "../controllers/dast-schedule.controller";
import { makeJobQueue } from "./job-queue.factory";
import { makeDastScanService } from "./dast-scan.factory";

export function makeDastScheduleService(): DastScheduleService {
  return new DastScheduleService(
    new ApplicationRepository(prisma),
    new ScanScheduleRepository(prisma),
    new ProjectRepository(prisma),
    new ProjectMemberRepository(prisma),
    new UserRepository(prisma),
    new AuditLogRepository(prisma),
    new NotificationRepository(prisma),
    makeJobQueue(),
    makeDastScanService(),
    new DastScanRepository(prisma),
    new DastFindingRepository(prisma),
  );
}

export function makeDastScheduleController(): DastScheduleController {
  return new DastScheduleController(makeDastScheduleService());
}
