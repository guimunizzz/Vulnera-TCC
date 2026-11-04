/**
 * Expõe somente o envio explícito de pergunta autenticada ao assistente.
 * Usa a factory e os contadores compartilhados da aplicação; consumido pelo
 * centralizador routes.ts. Nenhuma rota de montagem/polling gera texto.
 */
import { Router } from "express";
import { makeAssistantController } from "../factories/assistant.factory";
import type { AssistantController } from "../controllers/assistant.controller";
import { assistantRateLimitMiddleware, authRateLimitMiddleware } from "../middlewares/rate-limit.middleware";

export function createAssistantRoutes(controller: AssistantController = makeAssistantController()) {
  const router = Router();
  router.use(authRateLimitMiddleware);
  router.post("/chat", assistantRateLimitMiddleware, (req, res) => controller.chat(req, res));
  return router;
}
export const assistantRoutes = createAssistantRoutes();
