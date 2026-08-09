// app/api/src/factories/metrics.factory.ts
//
// FACTORY METHOD para o recurso Metrics (padrão GoF, obrigatório pelo
// CLAUDE.md §P2 e confirmado no ADR-019).
//
// MetricsService depende de quatro repositories, e três deles existem por um
// motivo só: controle de acesso. `MetricsRepository` faz a agregação;
// `ApplicationRepository`, `ProjectRepository` e `ProjectMemberRepository`
// respondem "este ator pode ver esta aplicação?" (RN16/RN17). Sem a factory,
// cada rota que quisesse métricas teria que remontar essa árvore à mão — e a
// primeira que esquecesse um dos três abriria um furo de isolamento.
//
// Convenção: arquivo `<recurso>.factory.ts`, função `make<Recurso>Controller`.
// Consumidores: `application.routes.ts` (summary/timeseries/insights) e
// `company.routes.ts` (comparison).

import { prisma } from "../database/prisma.database";
import { MetricsRepository } from "../repositories/metrics.repository";
import { ApplicationRepository } from "../repositories/application.repository";
import { ProjectRepository } from "../repositories/project.repository";
import { ProjectMemberRepository } from "../repositories/project-member.repository";
import { UserRepository } from "../repositories/user.repository";
import { MetricsService } from "../services/metrics.service";
import { MetricsController } from "../controllers/metrics.controller";

export function makeMetricsController(): MetricsController {
  const repository = new MetricsRepository(prisma);
  const applicationRepository = new ApplicationRepository(prisma);
  const projectRepository = new ProjectRepository(prisma);
  const projectMemberRepository = new ProjectMemberRepository(prisma);
  const userRepository = new UserRepository(prisma);

  const service = new MetricsService(
    repository,
    applicationRepository,
    projectRepository,
    projectMemberRepository,
    userRepository,
  );

  return new MetricsController(service);
}
