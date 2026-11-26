// app/api/src/factories/triage-inbox.factory.ts
//
// FACTORY METHOD da caixa de triagem única (ADR-062). As fontes são os
// serviços que JÁ existem, montados pelas próprias factories: a regra de quem
// vê cada scan, importação e casamento continua num lugar só.
//
// Consumidor: `triage-inbox.routes.ts`.

import { prisma } from "../database/prisma.database";
import { TriageInboxRepository } from "../repositories/triage-inbox.repository";
import { TriageInboxService } from "../services/triage-inbox.service";
import { TriageInboxController } from "../controllers/triage-inbox.controller";
import { makeCodeScanService } from "./code-scan.factory";
import { makeDastScanService } from "./dast-scan.factory";
import { makeThreatIntelService } from "./threat-intel.factory";

export function makeTriageInboxController(): TriageInboxController {
  const service = new TriageInboxService(new TriageInboxRepository(prisma), {
    dast: makeDastScanService(),
    codigo: makeCodeScanService(),
    threatIntel: makeThreatIntelService(),
  });
  return new TriageInboxController(service);
}
