// Caixa de triagem única (ADR-062). Só autenticação aqui: o que entra na caixa
// é o que cada fonte já deixa o usuário ver e triar (regra no service). O custo
// é de várias consultas fixas, por isso o bucket "expensive".
import { Router } from "express";
import { makeTriageInboxController } from "../factories/triage-inbox.factory";
import { authRateLimitMiddleware, endpointRateLimitMiddleware } from "../middlewares/rate-limit.middleware";

const router = Router();
const controller = makeTriageInboxController();

router.use(authRateLimitMiddleware);

router.get("/inbox", endpointRateLimitMiddleware("expensive"), (req, res) => controller.caixa(req, res));

export { router as triageInboxRoutes };
