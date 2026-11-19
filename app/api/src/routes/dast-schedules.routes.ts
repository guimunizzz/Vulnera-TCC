import { Router } from "express";
import { makeDastScheduleController } from "../factories/dast-schedule.factory";
import { authRateLimitMiddleware, endpointRateLimitMiddleware } from "../middlewares/rate-limit.middleware";

/**
 * ADR-056 — página /agendamentos. Criar, editar, remover e autorizar continuam
 * por aplicação (`/applications/:id/dast-*`) ou pelos ids daqui (agendamento
 * por URL). Aqui também ficam "Rodar agora" e o histórico. Quem vê e quem
 * executa é decidido no service (ADMIN, PENTESTER membro, CLIENT da empresa).
 */
const router = Router();
const controller = makeDastScheduleController();

router.use(authRateLimitMiddleware);

router.get("/", controller.listAll);
router.get("/targets", controller.targets);
// Agendamento só por URL; editar/remover servem aos dois tipos (as regras ficam no service).
router.post("/", controller.createByUrl);
router.put("/:scheduleId", controller.updateById);
router.delete("/:scheduleId", controller.removeById);
// "Rodar agora" conta no mesmo limite do DAST: cada clique cria um scan real.
router.post("/:scheduleId/run", endpointRateLimitMiddleware("dast"), controller.run);
router.get("/:scheduleId/history", controller.history);

export { router as dastScheduleRoutes };
