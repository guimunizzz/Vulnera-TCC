// app/api/src/factories/sla-monitor.factory.ts
//
// FACTORY METHOD do monitor de SLA (ADR-056, FILA-FUT-02).
// Monta Repository -> Service num ponto só. Quem consome é o worker da fila
// `sla-monitor` (services/queue/workers/sla-monitor.worker.ts), nunca uma rota.

import { prisma } from "../database/prisma.database";
import { SlaMonitorRepository } from "../repositories/sla-monitor.repository";
import { NotificationRepository } from "../repositories/notification.repository";
import { SlaMonitorService } from "../services/sla-monitor.service";

export function makeSlaMonitorService(): SlaMonitorService {
  return new SlaMonitorService(new SlaMonitorRepository(prisma), new NotificationRepository(prisma));
}
