// FACTORY METHOD (GoF) para o fluxo público de ativação de conta.
// Monta repositories, serviço, limiter e controller fora das rotas.
// A injeção permite testar o HTTP sem banco, senha real ou estado compartilhado.
// Consumidor direto: routes/account-activation.routes.ts; registro em routes/routes.ts.

import { AccountActivationController, type AccountActivationControllerService } from "../controllers/account-activation.controller";
import { loadAccountActivationRateLimitConfig } from "../config/account-activation-rate-limit.config";
import { prisma } from "../database/prisma.database";
import { AccessInvitationRepository } from "../repositories/access-invitation.repository";
import { AccessRequestRepository } from "../repositories/access-request.repository";
import { AccountActivationRateLimitService } from "../services/account-activation-rate-limit.service";
import { AccountActivationService } from "../services/account-activation.service";

export type AccountActivationRouteDependencies = {
  service: AccountActivationControllerService;
  limiter?: Pick<AccountActivationRateLimitService, "consumeIp" | "consumeToken">;
};

export function makeAccountActivationController(
  service: AccountActivationControllerService,
): AccountActivationController {
  return new AccountActivationController(service);
}

export function makeDefaultAccountActivationRouteDependencies(): Required<AccountActivationRouteDependencies> {
  const requests = new AccessRequestRepository(prisma);
  const invitations = new AccessInvitationRepository(prisma);
  const service = new AccountActivationService(requests, invitations);
  const limiter = new AccountActivationRateLimitService(loadAccountActivationRateLimitConfig());
  return { service, limiter };
}

export function makeDefaultAccountActivationRateLimiter(): AccountActivationRateLimitService {
  return new AccountActivationRateLimitService(loadAccountActivationRateLimitConfig());
}
