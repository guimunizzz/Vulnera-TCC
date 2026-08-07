// app/api/src/factories/report.factory.ts
//
// FACTORY METHOD para o recurso Report (padrão GoF).
// ReportService depende de quase todos os repositories do domínio de
// findings porque report-data é uma projeção agregada (Project + Application
// + Company + Vulnerability + Evidence + VulnerabilityComment + User) — sem
// a factory, cada consumidor teria que remontar essa árvore de 10
// dependências na mão.
//
// Convenção: arquivo `<recurso>.factory.ts`, função `make<Recurso>Controller`.
// Consumidor: report.routes.ts (POST/GET /reports) E project.routes.ts (que
// monta GET /:id/report-data — URL exigida pelo enunciado da Fase 6).

import { prisma } from "../database/prisma.database";
import { ReportRepository } from "../repositories/report.repository";
import { ProjectRepository } from "../repositories/project.repository";
import { ApplicationRepository } from "../repositories/application.repository";
import { CompanyRepository } from "../repositories/company.repository";
import { VulnerabilityRepository } from "../repositories/vulnerability.repository";
import { EvidenceRepository } from "../repositories/evidence.repository";
import { VulnerabilityCommentRepository } from "../repositories/vulnerability-comment.repository";
import { UserRepository } from "../repositories/user.repository";
import { ProjectMemberRepository } from "../repositories/project-member.repository";
import { AuditLogRepository } from "../repositories/audit-log.repository";
import { ReportService } from "../services/report.service";
import { ReportController } from "../controllers/report.controller";

export function makeReportController(): ReportController {
  const repository = new ReportRepository(prisma);
  const projectRepository = new ProjectRepository(prisma);
  const applicationRepository = new ApplicationRepository(prisma);
  const companyRepository = new CompanyRepository(prisma);
  const vulnerabilityRepository = new VulnerabilityRepository(prisma);
  const evidenceRepository = new EvidenceRepository(prisma);
  const commentRepository = new VulnerabilityCommentRepository(prisma);
  const userRepository = new UserRepository(prisma);
  const projectMemberRepository = new ProjectMemberRepository(prisma);
  const auditLogRepository = new AuditLogRepository(prisma);

  const service = new ReportService(
    repository,
    projectRepository,
    applicationRepository,
    companyRepository,
    vulnerabilityRepository,
    evidenceRepository,
    commentRepository,
    userRepository,
    projectMemberRepository,
    auditLogRepository,
  );
  return new ReportController(service);
}
