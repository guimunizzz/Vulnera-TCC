// app/api/src/factories/auth.factory.ts
//
// FACTORY METHOD para o recurso Auth
// ----------------------------------------------------------------------------
// Monta a stack Repository -> Service -> Controller do fluxo de autenticação.
// Quem consome: apenas auth.routes.ts.
// ----------------------------------------------------------------------------

import { prisma } from "../database/prisma.database";
import { AuthController } from "../controllers/auth.controller";
import { AuthService } from "../services/auth.service";
import { UserRepository } from "../repositories/user.repository";
import { RefreshTokenRepository } from "../repositories/refresh-token.repository";

export function makeAuthService(): AuthService {
  const userRepo = new UserRepository(prisma);
  const refreshRepo = new RefreshTokenRepository(prisma);
  return new AuthService(userRepo, refreshRepo);
}

export function makeAuthController(): AuthController {
  return new AuthController(makeAuthService());
}
