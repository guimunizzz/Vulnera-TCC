import { Router } from "express";
import { makeReportController } from "../factories/report.factory";
import { authMiddleware } from "../middlewares/auth.middleware";

// POST/GET /api/reports — metadado de geração (histórico). O JSON consolidado
// que alimenta o PDF é servido à parte, em GET /api/projects/:id/report-data
// (montado em project.routes.ts, URL exigida pelo enunciado da Fase 6).
const router = Router();
const controller = makeReportController();

router.use(authMiddleware);

router.post("/", (req, res) => controller.create(req, res));
router.get("/", (req, res) => controller.list(req, res));

export { router as reportRoutes };
