// Declara a gestão autenticada do time em /companies/me e a aceitação pública.
// O centralizador registra cada router; ownership é revalidado no service.
import { Router, type Application, type NextFunction, type Request, type RequestHandler, type Response } from "express";
import { authRateLimitMiddleware } from "../middlewares/rate-limit.middleware";
import { accountActivationJsonBodyParser } from "../middlewares/account-activation-body.middleware";
import { CompanyInvitationController } from "../controllers/company-invitation.controller";
import {
  makeDefaultCompanyInvitationRouteDependencies,
  makeCompanyInvitationController,
} from "../factories/company-invitation.factory";
import type { CompanyInvitationRouteDependencies } from "../factories/company-invitation.factory";
import type { CompanyInvitationPublicAction, CompanyInvitationRateLimitService } from "../services/company-invitation-rate-limit.service";

type ControllerMethod =
  | "listMembers"
  | "listInvitations"
  | "listInvitationHistory"
  | "createInvitation"
  | "resendInvitation"
  | "revokeInvitation"
  | "deactivateMember"
  | "validate"
  | "activate";
type Limiter = Pick<CompanyInvitationRateLimitService, "consumePublicIp" | "consumePublicToken">;
type Runtime = { controller: CompanyInvitationController; limiter: Limiter };

const defaultRuntimes = new WeakMap<Application, Runtime>();

export function makeCompanyTeamRoutes(dependencies?: CompanyInvitationRouteDependencies) {
  const router = Router();
  const injectedRuntime = dependencies ? createRuntime(dependencies) : undefined;

  // Root mounts this router under /companies. CompanyId is never a path/body input.
  router.get("/me/members", authRateLimitMiddleware, invoke("listMembers", injectedRuntime));
  router.get("/me/invitations/history", authRateLimitMiddleware, invoke("listInvitationHistory", injectedRuntime));
  router.get("/me/invitations", authRateLimitMiddleware, invoke("listInvitations", injectedRuntime));
  router.post("/me/invitations", authRateLimitMiddleware, invoke("createInvitation", injectedRuntime));
  router.post("/me/invitations/:invitationId/resend", authRateLimitMiddleware, invoke("resendInvitation", injectedRuntime));
  router.delete("/me/invitations/:invitationId", authRateLimitMiddleware, invoke("revokeInvitation", injectedRuntime));
  router.delete("/me/members/:userId", authRateLimitMiddleware, invoke("deactivateMember", injectedRuntime));
  return router;
}

export function makeCompanyInvitationActivationRoutes(dependencies?: CompanyInvitationRouteDependencies) {
  const router = Router();
  const injectedRuntime = dependencies ? createRuntime(dependencies) : undefined;
  router.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  router.post(
    "/validate",
    withPublicRateLimit("validate", "ip", injectedRuntime),
    accountActivationJsonBodyParser,
    withPublicRateLimit("validate", "token", injectedRuntime),
    invoke("validate", injectedRuntime),
  );
  router.post(
    "/activate",
    withPublicRateLimit("activate", "ip", injectedRuntime),
    accountActivationJsonBodyParser,
    withPublicRateLimit("activate", "token", injectedRuntime),
    invoke("activate", injectedRuntime),
  );
  return router;
}

function withPublicRateLimit(
  action: CompanyInvitationPublicAction,
  phase: "ip" | "token",
  injected?: Runtime,
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    let runtime: Runtime;
    try {
      runtime = injected ?? runtimeFor(req.app);
      const token = phase === "token" ? readBodyToken(req.body) : undefined;
      const result = phase === "ip"
        ? runtime.limiter.consumePublicIp(action, req.ip || req.socket.remoteAddress || "unknown")
        : token ? runtime.limiter.consumePublicToken(action, token) : undefined;
      if (result && !result.allowed) {
        res.setHeader("Retry-After", String(result.retryAfterSeconds));
        res.status(429).json({ error: "RATE_LIMITED" });
        return;
      }
      next();
    } catch {
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  };
}

function invoke(method: ControllerMethod, injected?: Runtime): RequestHandler {
  return (req: Request, res: Response): void => {
    let runtime: Runtime;
    try {
      runtime = injected ?? runtimeFor(req.app);
    } catch {
      res.status(500).json({ error: "INTERNAL_ERROR" });
      return;
    }
    void runtime.controller[method](req, res).catch(() => {
      if (!res.headersSent) res.status(500).json({ error: "INTERNAL_ERROR" });
    });
  };
}

function runtimeFor(app: Application): Runtime {
  let runtime = defaultRuntimes.get(app);
  if (!runtime) {
    runtime = createRuntime(makeDefaultCompanyInvitationRouteDependencies());
    defaultRuntimes.set(app, runtime);
  }
  return runtime;
}

function createRuntime(dependencies: CompanyInvitationRouteDependencies): Runtime {
  return {
    controller: makeCompanyInvitationController(dependencies.service),
    limiter: dependencies.limiter,
  };
}

function readBodyToken(body: unknown): string | undefined {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return undefined;
  const token = (body as Record<string, unknown>).token;
  return typeof token === "string" ? token : undefined;
}
