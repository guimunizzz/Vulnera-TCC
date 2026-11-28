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
import type { AccountActivationRouteDependencies } from "./factories/account-activation.factory";
import type { CompanyInvitationRouteDependencies } from "./factories/company-invitation.factory";
import { accountActivationBodyErrorHandler } from "./middlewares/account-activation-body.middleware";

export function createApp(options: {
  rateLimitService?: RateLimitService;
  accessRequestDependencies?: AccessRequestRouteDependencies;
  adminAccessRequestDependencies?: AdminAccessRequestRouteDependencies;
  accountActivationDependencies?: AccountActivationRouteDependencies;
  companyInvitationDependencies?: CompanyInvitationRouteDependencies;
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
  const jsonBodyParser = express.json();
  app.use((req, res, next) => {
    // A ativação usa parser próprio depois do limite de IP, inclusive para JSON inválido ou grande.
    const requestPath = req.path.toLowerCase();
    if (["/api/account-activation", "/api/company-invitations"].some(
      (prefix) => requestPath === prefix || requestPath.startsWith(prefix + "/"),
    )) {
      next();
      return;
    }
    jsonBodyParser(req, res, next);
  });
  app.use("/api", globalRateLimitMiddleware, makeApiRoutes({
    accessRequestDependencies: options.accessRequestDependencies,
    adminAccessRequestDependencies: options.adminAccessRequestDependencies,
    accountActivationDependencies: options.accountActivationDependencies,
    companyInvitationDependencies: options.companyInvitationDependencies,
  }));
  app.use(["/api/account-activation", "/api/company-invitations"], accountActivationBodyErrorHandler);
  return app;
}

const app = createApp();

export { app };
