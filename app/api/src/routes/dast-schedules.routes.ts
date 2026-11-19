import { Router } from "express";
import { makeDastScheduleController } from "../factories/dast-schedule.factory";
import { authRateLimitMiddleware } from "../middlewares/rate-limit.middleware";

/**
 * ADR-056 — leitura da página /agendamentos. Criar, editar, remover e
 * autorizar continuam por aplicação (`/applications/:id/dast-*`); aqui só se
 * lista o que a pessoa enxerga e as aplicações em que ela pode agendar.
 * Quem vê o quê é decidido no service (ADMIN, PENTESTER membro, CLIENT da empresa).
 */
const router = Router();
const controller = makeDastScheduleController();

router.use(authRateLimitMiddleware);

router.get("/", controller.listAll);
router.get("/targets", controller.targets);

export { router as dastScheduleRoutes };
