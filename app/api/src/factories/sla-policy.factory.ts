// app/api/src/factories/sla-policy.factory.ts
//
// FACTORY METHOD para a política de SLA (CP-2, padrão GoF).
// Depende de VulnerabilityRepository (reaplicar prazos aos findings ativos),
// UserRepository (companyId/companyRole do ator), CompanyRepository
// (existência da empresa) e AuditLogRepository (CREATE/UPDATE/SLA_POLICY_APPLIED).
//
// `makeSlaPolicyService` é exportada separada porque OUTROS services precisam
// resolver a política vigente (VulnerabilityService ao criar/recalcular,
// DastTriageService ao promover) — e a regra de "qual política vale" mora
// num lugar só.
//
// Convenção: arquivo `<recurso>.factory.ts`, função `make<Recurso>Controller`.
// Consumidor do controller: APENAS company.routes.ts.

import { prisma } from "../database/prisma.database";
import { SlaPolicyRepository } from "../repositories/sla-policy.repository";
import { VulnerabilityRepository } from "../repositories/vulnerability.repository";
import { UserRepository } from "../repositories/user.repository";
import { CompanyRepository } from "../repositories/company.repository";
import { AuditLogRepository } from "../repositories/audit-log.repository";
import { SlaPolicyService } from "../services/sla-policy.service";
import { SlaPolicyController } from "../controllers/sla-policy.controller";

export function makeSlaPolicyService(): SlaPolicyService {
  return new SlaPolicyService(
    new SlaPolicyRepository(prisma),
    new VulnerabilityRepository(prisma),
    new UserRepository(prisma),
    new CompanyRepository(prisma),
    new AuditLogRepository(prisma),
  );
}

export function makeSlaPolicyController(): SlaPolicyController {
  return new SlaPolicyController(makeSlaPolicyService());
}
