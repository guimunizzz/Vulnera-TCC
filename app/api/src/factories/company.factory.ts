// app/api/src/factories/company.factory.ts
//
// FACTORY METHOD para o recurso Company
// ----------------------------------------------------------------------------
// PADRÃO: Factory Method (GoF)
//
// PROBLEMA QUE RESOLVE:
//   Sem factory, a rota teria que fazer:
//     const repository = new CompanyRepository(prisma);
//     const userRepository = new UserRepository(prisma);
//     const service = new CompanyService(repository, userRepository);
//     const controller = new CompanyController(service);
//   Isso (1) embola responsabilidades (rota não monta dependências),
//   (2) repete código toda rota nova e (3) torna mock pra teste difícil.
//
// COMO RESOLVE:
//   1. Esconde complexidade de montagem (encapsulamento)
//   2. Centraliza injeção do PrismaClient
//   3. Permite factory irmã pra teste com mock
//
// CONVENÇÕES:
//   - Nome do arquivo: `<recurso>.factory.ts`
//   - Nome da função:  `make<Recurso>Controller`
//   - Quem consome:    APENAS o arquivo de routes do recurso
// ----------------------------------------------------------------------------

import { prisma } from "../database/prisma.database";
import { CompanyRepository } from "../repositories/company.repository";
import { UserRepository } from "../repositories/user.repository";
import { CompanyService } from "../services/company.service";
import { CompanyController } from "../controllers/company.controller";

export function makeCompanyController(): CompanyController {
  // Ordem: mais interno (Repository) → mais externo (Controller)
  const repository = new CompanyRepository(prisma);
  const userRepository = new UserRepository(prisma);
  const service = new CompanyService(repository, userRepository);
  const controller = new CompanyController(service);
  return controller;
}
