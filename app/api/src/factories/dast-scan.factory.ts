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
import { dastWatchdog } from "../services/dast-watchdog.service";
import { HeadersSensor } from "../services/sensors/headers.sensor";
import { SslSensor } from "../services/sensors/ssl.sensor";
import { FingerprintSensor } from "../services/sensors/fingerprint.sensor";
import { InternetDbSensor } from "../services/sensors/internetdb.sensor";
import { CrtShSensor } from "../services/sensors/crtsh.sensor";
import { NvdCveService } from "../services/sensors/nvd-cve.service";
import { CveRecordRepository } from "../repositories/cve-record.repository";
import { EnvVar } from "../config/EnvVar";
import { EnvKeys } from "../config/enum/EnvKeys";

export function makeDastScanService(): DastScanService {
  const repository = new DastScanRepository(prisma);
  const findingRepository = new DastFindingRepository(prisma);
  const auditLogRepository = new AuditLogRepository(prisma);
  const userRepository = new UserRepository(prisma);
  // O watchdog é SINGLETON de propósito (não `new DastWatchdog()` aqui): a
  // fila e o limite de concorrência só valem se todas as chamadas passarem
  // pela mesma instância — uma por factory daria um limite de 2 por
  // instância, que é o mesmo que não ter limite.
  // Sensores passivos rodam depois do ZAP, na ordem desta lista.
  const nvd = new NvdCveService(new CveRecordRepository(prisma), EnvVar.getOptional(EnvKeys.NVD_API_KEY, "").trim() || null);
  const sensors = [new HeadersSensor(), new SslSensor(), new FingerprintSensor(), new InternetDbSensor(nvd), new CrtShSensor()];
  return new DastScanService(repository, findingRepository, auditLogRepository, userRepository, dastWatchdog, sensors);
}

export function makeDastScanController(): DastScanController {
  const service = makeDastScanService();
  return new DastScanController(service);
}
