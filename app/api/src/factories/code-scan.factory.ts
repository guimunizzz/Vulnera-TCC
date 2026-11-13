// app/api/src/factories/code-scan.factory.ts
//
// FACTORY METHOD das importações SAST/SCA (ADR-052): monta
// Repository -> Service -> Controller num único ponto, como o resto do produto.
// Os repositories de Vulnerability/Application e o SLA entram pela promoção,
// único ponto em que o módulo escreve fora das próprias tabelas.

import { prisma } from "../database/prisma.database";
import { CodeScanRepository } from "../repositories/code-scan.repository";
import { ProjectRepository } from "../repositories/project.repository";
import { ProjectMemberRepository } from "../repositories/project-member.repository";
import { VulnerabilityRepository } from "../repositories/vulnerability.repository";
import { AuditLogRepository } from "../repositories/audit-log.repository";
import { ApplicationRepository } from "../repositories/application.repository";
import { CodeScanService } from "../services/code-scan.service";
import { CodeScanController } from "../controllers/code-scan.controller";
import { makeSlaPolicyService } from "./sla-policy.factory";

export function makeCodeScanService(): CodeScanService {
  return new CodeScanService(
    new CodeScanRepository(prisma),
    new ProjectRepository(prisma),
    new ProjectMemberRepository(prisma),
    new VulnerabilityRepository(prisma),
    new AuditLogRepository(prisma),
    makeSlaPolicyService(),
    new ApplicationRepository(prisma),
  );
}

export function makeCodeScanController(): CodeScanController {
  return new CodeScanController(makeCodeScanService());
}
