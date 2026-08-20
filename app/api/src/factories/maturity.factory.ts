// app/api/src/factories/maturity.factory.ts
//
// FACTORY METHOD para o recurso Maturity (padrão GoF).
// MaturityService depende de CompanyRepository (validar a company do
// assessment), UserRepository (RN19 — visibilidade do CLIENT) e
// ProjectMemberRepository (RN19 — visibilidade do PENTESTER "atribuído").
//
// Convenção: arquivo `<recurso>.factory.ts`, função `make<Recurso>Controller`.
// Consumidor: APENAS maturity.routes.ts.

import { prisma } from "../database/prisma.database";
import { MaturityRepository } from "../repositories/maturity.repository";
import { CompanyRepository } from "../repositories/company.repository";
import { UserRepository } from "../repositories/user.repository";
import { ProjectMemberRepository } from "../repositories/project-member.repository";
import { MaturityService } from "../services/maturity.service";
import { MaturityController } from "../controllers/maturity.controller";

export function makeMaturityController(): MaturityController {
  const repository = new MaturityRepository(prisma);
  const companyRepository = new CompanyRepository(prisma);
  const userRepository = new UserRepository(prisma);
  const projectMemberRepository = new ProjectMemberRepository(prisma);
  const service = new MaturityService(repository, companyRepository, userRepository, projectMemberRepository);
  return new MaturityController(service);
}
