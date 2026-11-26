// Declara validação e consumo anônimos do convite de ativação.
// Existe para manter o fluxo público sem autenticação e com limites próprios.
// Montado exclusivamente pelo centralizador routes/routes.ts.

import { Router, type Application, type Request, type Response, type NextFunction, type RequestHandler } from "express";
import { AccountActivationController } from "../controllers/account-activation.controller";
import {
  makeAccountActivationController,
  makeDefaultAccountActivationRouteDependencies,
  makeDefaultAccountActivationRateLimiter,
} from "../factories/account-activation.factory";
import type { AccountActivationRouteDependencies } from "../factories/account-activation.factory";
import { accountActivationJsonBodyParser } from "../middlewares/account-activation-body.middleware";
import {
  makeAccountActivationIpRateLimitMiddleware,
  makeAccountActivationTokenRateLimitMiddleware,
} from "../middlewares/account-activation-rate-limit.middleware";
import type { AccountActivationRateLimitAction, AccountActivationRateLimitService } from "../services/account-activation-rate-limit.service";

type ControllerMethod = "validate" | "activate";
type Limiter = Pick<AccountActivationRateLimitService, "consumeIp" | "consumeToken">;
type Runtime = { controller: AccountActivationController; limiter: Limiter };

const defaultRuntimes = new WeakMap<Application, Runtime>();

export function makeAccountActivationRoutes(dependencies?: AccountActivationRouteDependencies) {
  const router = Router();
  const injectedRuntime = dependencies ? createRuntime(dependencies) : undefined;

  router.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  router.post(
    "/validate",
    withRuntime("validate", "ip", injectedRuntime),
    accountActivationJsonBodyParser,
    withRuntime("validate", "token", injectedRuntime),
    invoke("validate", injectedRuntime),
  );
  router.post(
    "/activate",
    withRuntime("activate", "ip", injectedRuntime),
    accountActivationJsonBodyParser,
    withRuntime("activate", "token", injectedRuntime),
    invoke("activate", injectedRuntime),
  );
  return router;
}

function withRuntime(
  action: AccountActivationRateLimitAction,
  phase: "ip" | "token",
  injected?: Runtime,
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    let runtime: Runtime;
    try {
      runtime = injected ?? runtimeFor(req.app);
    } catch {
      res.status(500).json({ error: "INTERNAL_ERROR" });
      return;
    }
    const middleware = phase === "ip"
      ? makeAccountActivationIpRateLimitMiddleware(action, runtime.limiter)
      : makeAccountActivationTokenRateLimitMiddleware(action, runtime.limiter);
    middleware(req, res, next);
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
    runtime = createRuntime(makeDefaultAccountActivationRouteDependencies());
    defaultRuntimes.set(app, runtime);
  }
  return runtime;
}

function createRuntime(dependencies: AccountActivationRouteDependencies): Runtime {
  return {
    controller: makeAccountActivationController(dependencies.service),
    limiter: dependencies.limiter ?? makeDefaultAccountActivationRateLimiter(),
  };
}
