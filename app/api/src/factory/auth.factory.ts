// app/api/src/factory/auth.factory.ts
//
// FACTORY METHOD para o recurso Auth
// ----------------------------------------------------------------------------
// Monta a stack Repository -> Service -> Controller do fluxo de autenticação.
// Quem consome: apenas auth.routes.ts.
// ----------------------------------------------------------------------------

import { prisma } from "../database/prisma.database";
import { AuthController } from "../controller/auth.controller";
import { AuthService } from "../service/auth.service";
import { UserRepository } from "../repository/user.repository";
import { RefreshTokenRepository } from "../repository/refresh-token.repository";

export function makeAuthController(): AuthController {
  const userRepo = new UserRepository(prisma);
  const refreshRepo = new RefreshTokenRepository(prisma);
  const service = new AuthService(userRepo, refreshRepo);
  return new AuthController(service);
}
