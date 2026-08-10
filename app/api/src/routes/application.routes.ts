import { Router } from "express";
import { makeApplicationController } from "../factories/application.factory";
import { makeMetricsController } from "../factories/metrics.factory";
import { authMiddleware } from "../middlewares/auth.middleware";

const router = Router();
const controller = makeApplicationController();
// Métricas moram numa sub-rota de Application porque o recorte natural do
// dashboard é a APLICAÇÃO, não o projeto (Fase 6.5). O controller é montado
// aqui pela mesma razão que `report-data` foi montado em project.routes.ts na
// Fase 6: a URL exigida é aninhada, mas o recurso é outro.
const metricsController = makeMetricsController();

router.use(authMiddleware);

router.get("/", (req, res) => controller.list(req, res));

// ⚠️ ANTES de "/:id" — senão `/abc/metrics/summary` cairia em getById("abc")
// e o Express nunca chegaria aqui (CLAUDE.md: literal antes de paramétrica).
router.get("/:id/metrics/summary", (req, res) => metricsController.summary(req, res));
router.get("/:id/metrics/timeseries", (req, res) => metricsController.timeseries(req, res));
router.get("/:id/metrics/insights", (req, res) => metricsController.insights(req, res));

router.get("/:id", (req, res) => controller.getById(req, res));
router.post("/", (req, res) => controller.create(req, res));
router.put("/:id", (req, res) => controller.update(req, res));
router.delete("/:id", (req, res) => controller.delete(req, res));

export { router as applicationRoutes };
