// app/api/src/factories/project-member.factory.ts
//
// FACTORY METHOD para o recurso ProjectMember (padrão GoF).
// Sub-recurso de Project — consumido só por routes/project-member.routes.ts,
// que é montado como subrota dentro de routes/project.routes.ts.

import { prisma } from "../database/prisma.database";
import { ProjectMemberRepository } from "../repositories/project-member.repository";
import { ProjectRepository } from "../repositories/project.repository";
import { UserRepository } from "../repositories/user.repository";
import { ProjectMemberService } from "../services/project-member.service";
import { ProjectMemberController } from "../controllers/project-member.controller";

export function makeProjectMemberController(): ProjectMemberController {
  const repository = new ProjectMemberRepository(prisma);
  const projectRepository = new ProjectRepository(prisma);
  const userRepository = new UserRepository(prisma);
  const service = new ProjectMemberService(repository, projectRepository, userRepository);
  return new ProjectMemberController(service);
}
