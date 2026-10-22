// app/api/src/factories/findings-export.factory.ts
//
// FACTORY METHOD para a exportação Excel de findings (padrão GoF).
// Reusa o VulnerabilityService da listagem (mesmo filtro, mesmo escopo de
// acesso — é isso que garante que o arquivo nunca tem uma linha que a tela
// não mostraria), mais UserRepository (nome de quem exportou) e
// AuditLogRepository (FINDINGS_EXPORTED).
//
// Convenção: arquivo `<recurso>.factory.ts`, função `make<Recurso>Controller`.
// Consumidor: APENAS o arquivo de routes de Vulnerability (a rota é
// /vulnerabilities/export.xlsx).

import { prisma } from "../database/prisma.database";
import { loadExportMaxRows } from "../config/export.config";
import { AuditLogRepository } from "../repositories/audit-log.repository";
import { UserRepository } from "../repositories/user.repository";
import { FindingsExportService } from "../services/findings-export.service";
import { FindingsExportController } from "../controllers/findings-export.controller";
import { makeVulnerabilityService } from "./vulnerability.factory";

export function makeFindingsExportController(): FindingsExportController {
  const service = new FindingsExportService(
    makeVulnerabilityService(),
    new UserRepository(prisma),
    new AuditLogRepository(prisma),
    loadExportMaxRows(),
  );
  return new FindingsExportController(service);
}
