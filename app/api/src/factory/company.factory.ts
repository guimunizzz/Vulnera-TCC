// app/api/src/factory/company.factory.ts
//
// FACTORY METHOD para o recurso Company
// ----------------------------------------------------------------------------
// PADRÃO: Factory Method (GoF)
//
// PROBLEMA QUE RESOLVE:
//   Sem factory, a rota teria que fazer:
//     const repository = new CompanyRepository(prisma);
//     const planRepository = new PlanRepository(prisma);
//     const service = new CompanyService(repository, planRepository);
//     const controller = new CompanyController(service);
//   Isso (1) embola responsabilidades (rota não monta dependências),
//   (2) repete código toda rota nova e (3) torna mock pra teste difícil.
//
// COMO RESOLVE:
//   1. Esconde complexidade de montagem (encapsulamento)
//   2. Centraliza injeção do PrismaClient
//   3. Permite factory irmã pra teste com mock
//
// NOTA: CompanyService depende também de PlanRepository — validação de
// negócio "company só pode referenciar plano existente" (PLAN_NOT_FOUND).
//
// CONVENÇÕES:
//   - Nome do arquivo: `<recurso>.factory.ts`
//   - Nome da função:  `make<Recurso>Controller`
//   - Quem consome:    APENAS o arquivo de routes do recurso
// ----------------------------------------------------------------------------

import { prisma } from "../database/prisma.database";
import { CompanyRepository } from "../repository/company.repository";
import { PlanRepository } from "../repository/plan.repository";
import { CompanyService } from "../service/company.service";
import { CompanyController } from "../controller/company.controller";

export function makeCompanyController(): CompanyController {
  // Ordem: mais interno (Repository) → mais externo (Controller)
  const repository = new CompanyRepository(prisma);
  const planRepository = new PlanRepository(prisma);
  const service = new CompanyService(repository, planRepository);
  const controller = new CompanyController(service);
  return controller;
}
