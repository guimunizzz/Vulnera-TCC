// app/api/src/routes/admin-queues.routes.ts
//
// Painel de filas (ADR-056), montado em /admin/queues. Autenticação limitada
// e papel ADMIN no router inteiro: PENTESTER e CLIENT recebem 403, sem login
// 401. Não há ownership aqui — o painel é global e só o ADMIN o vê.

import { Router } from "express";
import { makeAdminQueuesController } from "../factories/admin-queues.factory";
import { authRateLimitMiddleware } from "../middlewares/rate-limit.middleware";
import { requireRole } from "../middlewares/require-role.middleware";

const router = Router();
const controller = makeAdminQueuesController();

router.use(authRateLimitMiddleware, requireRole("ADMIN"));

router.get("/", controller.painel);
router.post("/:name/jobs/:id/retry", controller.reprocessar);

export { router as adminQueuesRoutes };
