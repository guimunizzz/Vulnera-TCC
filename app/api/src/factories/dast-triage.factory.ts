// app/api/src/factories/dast-triage.factory.ts
//
// FACTORY METHOD para triagem/promoção/comparação do módulo DAST
// ----------------------------------------------------------------------------
// Mesma ideia de plan.factory.ts: monta Repository -> Service -> Controller num
// único ponto, pra rotas nunca instanciarem a stack inline (CLAUDE.md P2).
//
// Esta é a factory com MAIS repositories do projeto, e isso é proposital: é o
// único ponto do módulo DAST que cruza a fronteira pro núcleo do produto
// (Vulnerability/Project/ProjectMember). O silo do ADR-029 continua valendo
// pra todo o resto — só a promoção atravessa, e atravessa aqui, num lugar
// visível, em vez de espalhada.
// ----------------------------------------------------------------------------

import { prisma } from "../database/prisma.database";
import { DastScanRepository } from "../repositories/dast-scan.repository";
import { DastFindingRepository } from "../repositories/dast-finding.repository";
import { VulnerabilityRepository } from "../repositories/vulnerability.repository";
import { ProjectRepository } from "../repositories/project.repository";
import { ProjectMemberRepository } from "../repositories/project-member.repository";
import { AuditLogRepository } from "../repositories/audit-log.repository";
import { DastTriageService } from "../services/dast-triage.service";
import { DastTriageController } from "../controllers/dast-triage.controller";
import { ApplicationRepository } from "../repositories/application.repository";
import { makeSlaPolicyService } from "./sla-policy.factory";

export function makeDastTriageService(): DastTriageService {
  return new DastTriageService(
    new DastScanRepository(prisma),
    new DastFindingRepository(prisma),
    new VulnerabilityRepository(prisma),
    new ProjectRepository(prisma),
    new ProjectMemberRepository(prisma),
    new AuditLogRepository(prisma),
    // SLA (CP-2): a Vulnerability promovida nasce com relógio — contado da
    // PROMOÇÃO, não do scan (antes da triagem humana não era finding do produto).
    makeSlaPolicyService(),
    // VRS (CP-3): lê o contexto de risco da app para pontuar a promovida.
    new ApplicationRepository(prisma),
  );
}

export function makeDastTriageController(): DastTriageController {
  return new DastTriageController(makeDastTriageService());
}
