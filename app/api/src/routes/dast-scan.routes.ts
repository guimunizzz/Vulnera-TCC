// app/api/src/routes/dast-scan.routes.ts
//
// Rotas do módulo DAST — TODAS exigem authMiddleware + requireRole("PENTESTER","ADMIN").
// CLIENT recebe 403 em qualquer uma: o módulo não existe pra esse role, não
// há meio-termo de visibilidade aqui (diferente de Vulnerability, que CLIENT
// lê). Ownership fina (PENTESTER só vê os próprios scans) mora no service,
// não neste arquivo — ver dast-scan.service.ts.

import { Router } from "express";
import { makeDastScanController } from "../factories/dast-scan.factory";
import { authMiddleware } from "../middlewares/auth.middleware";
import { requireRole } from "../middlewares/require-role.middleware";

const router = Router();
const controller = makeDastScanController();

router.use(authMiddleware, requireRole("PENTESTER", "ADMIN"));

router.post("/", (req, res) => controller.create(req, res));
router.get("/", (req, res) => controller.list(req, res));
router.get("/:id", (req, res) => controller.getById(req, res));
router.post("/:id/cancel", (req, res) => controller.cancel(req, res));
router.get("/:id/findings", (req, res) => controller.listFindings(req, res));
router.get("/:id/report/html", (req, res) => controller.getReportHtml(req, res));
router.get("/:id/report/data", (req, res) => controller.getReportData(req, res));

export { router as dastScanRoutes };
