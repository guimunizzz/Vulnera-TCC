import express from "express";
import cors from "cors";
import { apiRoutes } from "./routes/routes";
import { EnvVar } from "./config/EnvVar";
import { EnvKeys } from "./config/enum/EnvKeys";
import { makeRateLimitService } from "./factories/rate-limit.factory";
import { globalRateLimitMiddleware } from "./middlewares/rate-limit.middleware";
import type { RateLimitService } from "./services/rate-limit.service";

export function createApp(options: { rateLimitService?: RateLimitService } = {}) {
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
  app.use("/api", globalRateLimitMiddleware, apiRoutes);
  return app;
}

const app = createApp();

export { app };
