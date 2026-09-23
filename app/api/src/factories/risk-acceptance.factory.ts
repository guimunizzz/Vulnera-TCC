// app/api/src/factories/risk-acceptance.factory.ts
//
// FACTORY METHOD para o aceite formal de risco (CP-4, padrão GoF).
//
// Depende de VulnerabilityRepository (carregar o finding e EMPURRAR o prazo de
// SLA ao fim da pausa), ProjectMemberRepository (RN17 — PENTESTER membro pode
// solicitar), UserRepository (companyId/companyRole lidos do BANCO, nunca do
// JWT) e AuditLogRepository (os cinco eventos do ciclo).
//
// `makeRiskAcceptanceService` é exportada separada porque o VulnerabilityService
// precisa saber se há aceite vigente para derivar o estado ACCEPTED do SLA —
// a regra de "está valendo?" mora num lugar só.
//
// Convenção: arquivo `<recurso>.factory.ts`, função `make<Recurso>Controller`.

import { prisma } from "../database/prisma.database";
import { RiskAcceptanceRepository } from "../repositories/risk-acceptance.repository";
import { VulnerabilityRepository } from "../repositories/vulnerability.repository";
import { ProjectMemberRepository } from "../repositories/project-member.repository";
import { UserRepository } from "../repositories/user.repository";
import { AuditLogRepository } from "../repositories/audit-log.repository";
import { RiskAcceptanceService } from "../services/risk-acceptance.service";
import { RiskAcceptanceController } from "../controllers/risk-acceptance.controller";

export function makeRiskAcceptanceService(): RiskAcceptanceService {
  return new RiskAcceptanceService(
    new RiskAcceptanceRepository(prisma),
    new VulnerabilityRepository(prisma),
    new ProjectMemberRepository(prisma),
    new UserRepository(prisma),
    new AuditLogRepository(prisma),
  );
}

export function makeRiskAcceptanceController(): RiskAcceptanceController {
  return new RiskAcceptanceController(makeRiskAcceptanceService());
}
