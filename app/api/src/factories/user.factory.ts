// app/api/src/factories/user.factory.ts
//
// FACTORY METHOD para o recurso User
// ----------------------------------------------------------------------------
// Monta a stack Repository -> Service -> Controller do CRUD de usuário.
// Quem consome: apenas user.routes.ts.
// ----------------------------------------------------------------------------

import { prisma } from "../database/prisma.database";
import { UserController } from "../controllers/user.controller";
import { UserService } from "../services/user.service";
import { UserRepository } from "../repositories/user.repository";

export function makeUserController(): UserController {
  const userRepo = new UserRepository(prisma);
  const service = new UserService(userRepo);
  return new UserController(service);
}
