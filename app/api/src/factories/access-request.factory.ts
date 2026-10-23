// FACTORY METHOD (GoF) para o fluxo público de AccessRequest.
// Monta Repository → Service → Controller e injeta CAPTCHA e limites próprios;
// isso mantém a composição fora das rotas e permite mock determinístico nos testes.
// Consumidor direto: routes/access-request.routes.ts; seu único montador é routes/routes.ts.

import { TurnstileCaptchaAdapter } from "../adapters/turnstile-captcha.adapter";
import { loadAccessRequestRateLimitConfig } from "../config/access-request-rate-limit.config";
import { loadTurnstileCaptchaConfig } from "../config/turnstile.config";
import { prisma } from "../database/prisma.database";
import { AccessRequestController, type PublicAccessRequestService } from "../controllers/access-request.controller";
import { AccessRequestRepository } from "../repositories/access-request.repository";
import type { CaptchaVerifier } from "../models/captcha.model";
import { AccessRequestRateLimitService } from "../services/access-request-rate-limit.service";
import { AccessRequestService } from "../services/access-request.service";
import { makeEmailVerificationService } from "./email-verification.factory";
import type { AccessRequestProtectionDependencies } from "../middlewares/access-request-rate-limit.middleware";

export type AccessRequestRouteDependencies = {
  service: PublicAccessRequestService;
  limiter: AccessRequestProtectionDependencies["limiter"];
  captchaVerifier: CaptchaVerifier;
};

export function makeAccessRequestController(service: PublicAccessRequestService): AccessRequestController {
  return new AccessRequestController(service);
}

/** Usada somente no primeiro acesso à rota pública quando não há dependências injetadas. */
export function makeDefaultAccessRequestRouteDependencies(): AccessRequestRouteDependencies {
  const rateLimitConfig = loadAccessRequestRateLimitConfig();
  const repository = new AccessRequestRepository(prisma);
  const verification = makeEmailVerificationService();
  const service = new AccessRequestService(repository, verification, {
    cooldownMs: rateLimitConfig.emailCooldownMs,
  });
  return {
    service,
    limiter: new AccessRequestRateLimitService(rateLimitConfig),
    captchaVerifier: new TurnstileCaptchaAdapter(loadTurnstileCaptchaConfig()),
  };
}
