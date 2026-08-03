// app/api/src/factory/user.factory.ts
//
// FACTORY METHOD para o recurso User
// ----------------------------------------------------------------------------
// Monta a stack Repository -> Service -> Controller do CRUD de usuário.
// Quem consome: apenas user.routes.ts.
// ----------------------------------------------------------------------------

import { prisma } from "../database/prisma.database";
import { UserController } from "../controller/user.controller";
import { UserService } from "../service/user.service";
import { UserRepository } from "../repository/user.repository";

export function makeUserController(): UserController {
  const userRepo = new UserRepository(prisma);
  const service = new UserService(userRepo);
  return new UserController(service);
}
