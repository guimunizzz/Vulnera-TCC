// app/api/src/factories/evidence.factory.ts
//
// FACTORY METHOD para o recurso Evidence. Depende de VulnerabilityRepository
// (resolver companyId/projectId do dono) e ProjectMemberRepository +
// UserRepository (mesma checagem de visibilidade/escrita do Vulnerability).
//
// Convenção: arquivo `<recurso>.factory.ts`, função `make<Recurso>Controller`.
// Consumidor: APENAS o arquivo de routes do recurso.

import { prisma } from "../database/prisma.database";
import { EvidenceRepository } from "../repositories/evidence.repository";
import { VulnerabilityRepository } from "../repositories/vulnerability.repository";
import { ProjectMemberRepository } from "../repositories/project-member.repository";
import { UserRepository } from "../repositories/user.repository";
import { EvidenceService } from "../services/evidence.service";
import { EvidenceController } from "../controllers/evidence.controller";

export function makeEvidenceController(): EvidenceController {
  const repository = new EvidenceRepository(prisma);
  const vulnerabilityRepository = new VulnerabilityRepository(prisma);
  const projectMemberRepository = new ProjectMemberRepository(prisma);
  const userRepository = new UserRepository(prisma);
  const service = new EvidenceService(repository, vulnerabilityRepository, projectMemberRepository, userRepository);
  return new EvidenceController(service);
}
