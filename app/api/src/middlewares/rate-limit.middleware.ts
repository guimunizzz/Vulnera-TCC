/**
 * rate-limit.middleware.ts
 *
 * Adapta RateLimitService ao Express em camadas: global, autenticação, usuário,
 * tenant seguro e endpoints caros. Consumido por app.ts e pelos routers; não
 * substitui authMiddleware, requireRole ou ownership de domínio.
 */

import type { NextFunction, Request, Response } from "express";
import { authMiddleware } from "./auth.middleware";
import type { RateLimitScope } from "../config/rate-limit.config";
import { RateLimitService } from "../services/rate-limit.service";
import { verifyRefreshToken } from "../utils/jwt.util";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Locals {
      rateLimitService?: RateLimitService;
    }
  }
}

function serviceFor(req: Request): RateLimitService {
  const service = req.app.locals.rateLimitService;
  if (!service) throw new Error("RATE_LIMIT_SERVICE_MISSING");
  return service;
}

function normalizedRoute(req: Request): string {
  return `${req.baseUrl}${req.path}`
    .replace(/\/[a-z0-9]{20,}/gi, "/:id")
    .replace(/\/\d+/g, "/:id");
}

function clientFingerprint(req: Request): string {
  return RateLimitService.fingerprint(req.ip || "unknown");
}

function accountFingerprint(req: Request): string {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  return RateLimitService.fingerprint(email);
}

function refreshFingerprint(req: Request): string {
  const token = typeof req.body?.refreshToken === "string" ? req.body.refreshToken : "";
  try {
    // Token válido muda em cada rotation; userId assinado mantém uma chave
    // estável e impede obter um novo burst por refresh bem-sucedido.
    return RateLimitService.fingerprint(`user:${verifyRefreshToken(token).userId}`);
  } catch {
    // Token inválido não tem user confiável: limitamos seu hash sem logar o
    // valor cru ou revelar se pertence a uma conta.
    return RateLimitService.fingerprint(`token:${token}`);
  }
}

function blocked(req: Request, res: Response, scope: RateLimitScope, result: { retryAfterSeconds: number; resetAfterSeconds: number; limit: number }): void {
  res.setHeader("Retry-After", String(result.retryAfterSeconds));
  res.setHeader("RateLimit-Limit", String(result.limit));
  res.setHeader("RateLimit-Remaining", "0");
  res.setHeader("RateLimit-Reset", String(result.resetAfterSeconds));
  res.status(429).json({
    code: "RATE_LIMITED",
    message: "Muitas requisições. Tente novamente em alguns segundos.",
    retryAfterSeconds: result.retryAfterSeconds,
  });
  // Não entram em log identidade, token, e-mail, companyId nem query string.
  console.warn(
    `[rate-limit] scope=${scope} method=${req.method} route=${normalizedRoute(req)} retryAfter=${result.retryAfterSeconds}`,
  );
}

function consume(req: Request, res: Response, scope: RateLimitScope, key: string): boolean {
  const result = serviceFor(req).consume(scope, key);
  if (!result.allowed) {
    blocked(req, res, scope, result);
    return false;
  }
  res.setHeader("RateLimit-Limit", String(result.limit));
  res.setHeader("RateLimit-Remaining", String(result.remaining));
  res.setHeader("RateLimit-Reset", String(result.resetAfterSeconds));
  return true;
}

/** Bucket global antes das rotas; /health não compete com tráfego de produto. */
export function globalRateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (req.path === "/health") return next();
  if (!consume(req, res, "global", "all")) return;
  next();
}

/** Auth continua isolado; o limiter só roda depois que req.user é confiável. */
export function authRateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
  authMiddleware(req, res, () => {
    void applyAuthenticatedLimits(req, res, next);
  });
}

async function applyAuthenticatedLimits(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const service = serviceFor(req);
    if (!service.config.enabled) return next();

    const actor = req.user!;
    if (!consume(req, res, "user", actor.userId)) return;

    const tenantId = await service.resolveTenant(actor);
    if (tenantId && !consume(req, res, "tenant", tenantId)) return;

    if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
      if (!consume(req, res, "write", actor.userId)) return;
    }
    next();
  } catch (error) {
    console.error("RateLimitMiddleware.authenticated", error);
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
}

/** Política adicional para query/agregação, report e criação de DAST. */
export function endpointRateLimitMiddleware(scope: "expensive" | "report" | "dast") {
  return (req: Request, res: Response, next: NextFunction): void => {
    const actor = req.user;
    if (!actor || !consume(req, res, scope, actor.userId)) return;
    next();
  };
}

/** Login reserva a conta, mas devolve o token do bucket se a autenticação for bem-sucedida. */
export function loginRateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
  const ipKey = clientFingerprint(req);
  if (!consume(req, res, "auth-login-ip", ipKey)) return;
  const accountKey = accountFingerprint(req);
  if (!consume(req, res, "auth-login-account", accountKey)) return;
  res.once("finish", () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      serviceFor(req).refund("auth-login-account", accountKey);
      serviceFor(req).refund("auth-login-ip", ipKey);
    }
  });
  next();
}

export function registerRateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!consume(req, res, "auth-register-ip", clientFingerprint(req))) return;
  next();
}

export function refreshRateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!consume(req, res, "auth-refresh", refreshFingerprint(req))) return;
  next();
}

/** Exportado para testes de normalização; a rota nunca inclui query string. */
export { normalizedRoute };
