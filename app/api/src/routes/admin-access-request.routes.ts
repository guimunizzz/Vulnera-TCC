// Declara a fila e as decisões administrativas de AccessRequest.
// Exige JWT, role ADMIN e revalidação do papel persistido antes de todo endpoint.
// Registrado exclusivamente pelo centralizador routes/routes.ts.

import { Router, type Application, type Request, type Response, type NextFunction, type RequestHandler } from "express";
import { AdminAccessRequestController } from "../controllers/admin-access-request.controller";
import {
  makeAdminAccessRequestController,
  makeDefaultAdminAccessRequestRouteDependencies,
  makeAdminAccessRequestAdminMiddleware,
} from "../factories/admin-access-request.factory";
import type { AdminAccessRequestRouteDependencies } from "../factories/admin-access-request.factory";
import { authRateLimitMiddleware } from "../middlewares/rate-limit.middleware";
import { requireRole } from "../middlewares/require-role.middleware";

type AdminControllerMethod = "list" | "getById" | "events" | "approve" | "reject" | "resendInvitation";

type Runtime = {
  controller: AdminAccessRequestController;
  authorization: ReturnType<typeof makeAdminAccessRequestAdminMiddleware>;
};

const defaultRuntimes = new WeakMap<Application, Runtime>();

export function makeAdminAccessRequestRoutes(dependencies?: AdminAccessRequestRouteDependencies) {
  const router = Router();
  const injectedRuntime = dependencies ? createRuntime(dependencies) : undefined;

  router.use((req, res, next) => {
    let runtime: Runtime;
    try {
      runtime = injectedRuntime ?? runtimeFor(req.app);
    } catch {
      res.status(500).json({ error: "INTERNAL_ERROR" });
      return;
    }
    authRateLimitMiddleware(req, res, (error?: unknown) => {
      if (error) return next(error);
      if (res.headersSent) return;
      requireRole("ADMIN")(req, res, (roleError?: unknown) => {
        if (roleError) return next(roleError);
        if (res.headersSent) return;
        runtime.authorization(req, res, next);
      });
    });
  });

  router.get("/", invoke("list", injectedRuntime));
  router.get("/:id/events", invoke("events", injectedRuntime));
  router.get("/:id", invoke("getById", injectedRuntime));
  router.post("/:id/approve", invoke("approve", injectedRuntime));
  router.post("/:id/reject", invoke("reject", injectedRuntime));
  router.post("/:id/resend-invitation", invoke("resendInvitation", injectedRuntime));
  return router;
}

function invoke(method: AdminControllerMethod, injected?: Runtime): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    let runtime: Runtime;
    try {
      runtime = injected ?? runtimeFor(req.app);
    } catch {
      res.status(500).json({ error: "INTERNAL_ERROR" });
      return;
    }
    void runtime.controller[method](req, res).catch(() => {
      if (!res.headersSent) res.status(500).json({ error: "INTERNAL_ERROR" });
      else next();
    });
  };
}

function runtimeFor(app: Application): Runtime {
  let runtime = defaultRuntimes.get(app);
  if (!runtime) {
    runtime = createRuntime(makeDefaultAdminAccessRequestRouteDependencies());
    defaultRuntimes.set(app, runtime);
  }
  return runtime;
}

function createRuntime(dependencies: AdminAccessRequestRouteDependencies): Runtime {
  return {
    controller: makeAdminAccessRequestController(dependencies),
    authorization: makeAdminAccessRequestAdminMiddleware(dependencies),
  };
}
