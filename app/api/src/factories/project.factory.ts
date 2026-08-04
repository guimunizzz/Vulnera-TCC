// app/api/src/factories/project.factory.ts
//
// FACTORY METHOD para o recurso Project (padrão GoF).
// Depende de ApplicationRepository (herdar companyId — RN06), UserRepository
// (ownership CLIENT), ProjectMemberRepository (visibilidade/permissão PENTESTER
// — RN17) e AuditLogRepository (STATUS_CHANGE em toda transição).
//
// Convenção: arquivo `<recurso>.factory.ts`, função `make<Recurso>Controller`.
// Consumidor: APENAS o arquivo de routes do recurso.

import { prisma } from "../database/prisma.database";
import { ProjectRepository } from "../repositories/project.repository";
import { ApplicationRepository } from "../repositories/application.repository";
import { UserRepository } from "../repositories/user.repository";
import { ProjectMemberRepository } from "../repositories/project-member.repository";
import { AuditLogRepository } from "../repositories/audit-log.repository";
import { ProjectService } from "../services/project.service";
import { ProjectController } from "../controllers/project.controller";

export function makeProjectController(): ProjectController {
  const repository = new ProjectRepository(prisma);
  const applicationRepository = new ApplicationRepository(prisma);
  const userRepository = new UserRepository(prisma);
  const projectMemberRepository = new ProjectMemberRepository(prisma);
  const auditLogRepository = new AuditLogRepository(prisma);
  const service = new ProjectService(
    repository,
    applicationRepository,
    userRepository,
    projectMemberRepository,
    auditLogRepository,
  );
  return new ProjectController(service);
}
