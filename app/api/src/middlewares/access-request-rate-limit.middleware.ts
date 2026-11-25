/**
 * Protege request, resend e verify com buckets de IP e validação CAPTCHA.
 * Existe antes dos controllers públicos para recusar abuso barato cedo;
 * é consumido pelas rotas de AccessRequest com dependências injetadas.
 */

import type { Request, RequestHandler, Response } from "express";
import type { CaptchaVerifier } from "../models/captcha.model";
import type { AccessRequestRateLimitService, AccessRequestRateLimitAction } from "../services/access-request-rate-limit.service";

export type AccessRequestProtectionDependencies = {
  limiter: Pick<AccessRequestRateLimitService, "consumeIp" | "consumeEmail">;
  captchaVerifier: CaptchaVerifier;
};

const CAPTCHA_TOKEN_MAX_LENGTH = 2_048;

export function makeAccessRequestProtectionMiddleware(
  action: AccessRequestRateLimitAction,
  dependencies: AccessRequestProtectionDependencies,
): RequestHandler {
  return async (req, res, next): Promise<void> => {
    try {
      const remoteIp = remoteIpFor(req);
      const ipResult = dependencies.limiter.consumeIp(action, remoteIp ?? "unknown");
      if (!ipResult.allowed) {
        sendRateLimitResponse(res, ipResult.retryAfterSeconds);
        return;
      }

      // Confirmação de e-mail já exige um token aleatório de uso único enviado por e-mail.
      if (action === "verify") {
        next();
        return;
      }

      const captchaToken = req.body?.captchaToken;
      if (captchaToken === undefined || captchaToken === null || captchaToken === "") {
        res.status(400).json({ code: "MISSING_CAPTCHA" });
        return;
      }
      if (typeof captchaToken !== "string" || captchaToken.length > CAPTCHA_TOKEN_MAX_LENGTH) {
        res.status(400).json({ code: "INVALID_CAPTCHA" });
        return;
      }

      let validCaptcha = false;
      try {
        validCaptcha = await dependencies.captchaVerifier.verify({
          token: captchaToken,
          ...(remoteIp ? { remoteIp } : {}),
        });
      } catch {
        // Adapter alternativo ou falha não prevista também permanecem fechados.
        validCaptcha = false;
      }
      if (!validCaptcha) {
        res.status(400).json({ code: "INVALID_CAPTCHA" });
        return;
      }

      const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
      if (email) {
        const emailResult = dependencies.limiter.consumeEmail(email);
        if (!emailResult.allowed) {
          sendRateLimitResponse(res, emailResult.retryAfterSeconds);
          return;
        }
      }

      next();
    } catch {
      if (!res.headersSent) {
        res.status(500).json({ code: "INTERNAL_ERROR" });
      }
    }
  };
}

function remoteIpFor(req: Request): string | undefined {
  return req.ip || req.socket.remoteAddress || undefined;
}

function sendRateLimitResponse(res: Response, retryAfterSeconds: number): void {
  res.setHeader("Retry-After", String(retryAfterSeconds));
  res.status(429).json({
    code: "RATE_LIMITED",
    message: "Muitas requisições. Tente novamente em alguns segundos.",
    retryAfterSeconds,
  });
}
