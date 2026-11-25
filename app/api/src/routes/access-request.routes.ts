// Declara os endpoints anônimos de solicitação e verificação de e-mail.
// Adia a criação de SMTP/CAPTCHA até o primeiro uso e aceita dependências de teste.
// Montado somente por routes/routes.ts para preservar o registro central da API.

import { Router, type Application, type Request, type Response, type NextFunction, type RequestHandler } from "express";
import { AccessRequestController } from "../controllers/access-request.controller";
import { makeAccessRequestController, makeDefaultAccessRequestRouteDependencies } from "../factories/access-request.factory";
import type { AccessRequestRouteDependencies } from "../factories/access-request.factory";
import { makeAccessRequestProtectionMiddleware } from "../middlewares/access-request-rate-limit.middleware";

type AccessRequestAction = "request" | "resend" | "verify";
type ControllerMethod = "request" | "resend" | "verifyEmail";

type Runtime = {
  controller: AccessRequestController;
  protection: Record<AccessRequestAction, RequestHandler>;
};

const defaultRuntimes = new WeakMap<Application, Runtime>();

export function makeAccessRequestRoutes(dependencies?: AccessRequestRouteDependencies) {
  const router = Router();
  const injectedRuntime = dependencies ? createRuntime(dependencies) : undefined;

  router.post("/", invoke("request", "request", injectedRuntime));
  router.post("/resend-verification", invoke("resend", "resend", injectedRuntime));
  router.post("/verify-email", invoke("verify", "verifyEmail", injectedRuntime));
  return router;
}

function invoke(action: AccessRequestAction, method: ControllerMethod, injected?: Runtime): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    let runtime: Runtime;
    try {
      runtime = injected ?? runtimeFor(req.app);
    } catch {
      res.status(500).json({ error: "INTERNAL_ERROR" });
      return;
    }

    runtime.protection[action](req, res, (error?: unknown) => {
      if (error) {
        next(error);
        return;
      }
      if (res.headersSent) return;
      void runtime.controller[method](req, res).catch(() => {
        if (!res.headersSent) res.status(500).json({ error: "INTERNAL_ERROR" });
      });
    });
  };
}

function runtimeFor(app: Application): Runtime {
  let runtime = defaultRuntimes.get(app);
  if (!runtime) {
    runtime = createRuntime(makeDefaultAccessRequestRouteDependencies());
    defaultRuntimes.set(app, runtime);
  }
  return runtime;
}

function createRuntime(dependencies: AccessRequestRouteDependencies): Runtime {
  return {
    controller: makeAccessRequestController(dependencies.service),
    protection: {
      request: makeAccessRequestProtectionMiddleware("request", dependencies),
      resend: makeAccessRequestProtectionMiddleware("resend", dependencies),
      verify: makeAccessRequestProtectionMiddleware("verify", dependencies),
    },
  };
}
