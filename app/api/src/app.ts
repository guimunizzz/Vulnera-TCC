import express from "express";
import cors from "cors";
import { makeApiRoutes } from "./routes/routes";
import { EnvVar } from "./config/EnvVar";
import { EnvKeys } from "./config/enum/EnvKeys";
import { makeRateLimitService } from "./factories/rate-limit.factory";
import { globalRateLimitMiddleware } from "./middlewares/rate-limit.middleware";
import type { RateLimitService } from "./services/rate-limit.service";
import type { AccessRequestRouteDependencies } from "./factories/access-request.factory";
import type { AdminAccessRequestRouteDependencies } from "./factories/admin-access-request.factory";

export function createApp(options: {
  rateLimitService?: RateLimitService;
  accessRequestDependencies?: AccessRequestRouteDependencies;
  adminAccessRequestDependencies?: AdminAccessRequestRouteDependencies;
} = {}) {
  const app = express();
  const rateLimitService = options.rateLimitService ?? makeRateLimitService();
  // 0 = não confia em X-Forwarded-For localmente. Render fica explícito em 1;
  // jamais usamos `true`, que aceitaria uma cadeia arbitrária enviada pelo cliente.
  app.set("trust proxy", rateLimitService.config.trustProxyHops);
  app.locals.rateLimitService = rateLimitService;
  // Cabeçalhos que a web precisa LER. Como ela é outra origem, o navegador esconde tudo que não for
  // exposto aqui: sem Content-Disposition a exportação Excel perde o nome do arquivo (escopo e
  // carimbo); sem Retry-After o aviso de rate limit não consegue dizer quantos segundos esperar.
  app.use(
    cors({
      origin: EnvVar.getOptional(EnvKeys.CORS_ORIGIN, "http://localhost:3000"),
      credentials: true,
      exposedHeaders: ["Content-Disposition", "Retry-After"],
    }),
  );
  app.use(express.json());
  app.use("/api", globalRateLimitMiddleware, makeApiRoutes({
    accessRequestDependencies: options.accessRequestDependencies,
    adminAccessRequestDependencies: options.adminAccessRequestDependencies,
  }));
  return app;
}

const app = createApp();

export { app };
