// Aplica os buckets do fluxo de ativação antes do controller.
// Existe para rejeitar abuso sem registrar IPs ou convites em logs.
// Consumido somente pelas rotas de validação e ativação de conta.

import type { Request, RequestHandler, Response } from "express";
import type { AccountActivationRateLimitAction, AccountActivationRateLimitService } from "../services/account-activation-rate-limit.service";

type Limiter = Pick<AccountActivationRateLimitService, "consumeIp" | "consumeToken">;

export function makeAccountActivationIpRateLimitMiddleware(
  action: AccountActivationRateLimitAction,
  limiter: Limiter,
): RequestHandler {
  return (req, res, next): void => {
    try {
      const result = limiter.consumeIp(action, remoteIpFor(req));
      if (!result.allowed) {
        sendRateLimitResponse(res, result.retryAfterSeconds);
        return;
      }
      next();
    } catch {
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  };
}

export function makeAccountActivationTokenRateLimitMiddleware(
  action: AccountActivationRateLimitAction,
  limiter: Limiter,
): RequestHandler {
  return (req, res, next): void => {
    const token = bodyRecord(req.body)?.token;
    if (typeof token !== "string") {
      next();
      return;
    }
    try {
      const result = limiter.consumeToken(action, token);
      if (!result.allowed) {
        sendRateLimitResponse(res, result.retryAfterSeconds);
        return;
      }
      next();
    } catch {
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  };
}

function bodyRecord(body: unknown): Record<string, unknown> | undefined {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return undefined;
  return body as Record<string, unknown>;
}

function remoteIpFor(req: Request): string {
  return req.ip || req.socket.remoteAddress || "unknown";
}

function sendRateLimitResponse(res: Response, retryAfterSeconds: number): void {
  res.setHeader("Retry-After", String(retryAfterSeconds));
  res.status(429).json({ error: "RATE_LIMITED" });
}
