// app/api/src/routes/code-scan.routes.ts
//
// Importações SAST/SCA (ADR-052). Autenticação + requireRole("PENTESTER",
// "ADMIN") no router inteiro: CLIENT não vê achado de ferramenta não triado.
// Ownership por projeto (PENTESTER só nos projetos de que é membro) mora no
// service — ver code-scan.service.ts.

import { Router } from "express";
import { makeCodeScanController } from "../factories/code-scan.factory";
import { authRateLimitMiddleware, endpointRateLimitMiddleware } from "../middlewares/rate-limit.middleware";
import { requireRole } from "../middlewares/require-role.middleware";
import { uploadSingleFile } from "../middlewares/upload.middleware";

const router = Router();
const controller = makeCodeScanController();

router.use(authRateLimitMiddleware, requireRole("PENTESTER", "ADMIN"));

// Importar lê e grava até milhares de linhas: entra na política "expensive".
router.post("/", endpointRateLimitMiddleware("expensive"), uploadSingleFile, (req, res) => controller.importReport(req, res));
router.get("/", (req, res) => controller.listImports(req, res));

// ⚠️ "/findings/..." é literal no primeiro segmento e vem ANTES de "/:id".
router.patch("/findings/:findingId/triage", (req, res) => controller.triage(req, res));
router.get("/findings/:findingId/promotion-draft", (req, res) => controller.getPromotionDraft(req, res));
router.post("/findings/:findingId/promote", (req, res) => controller.promote(req, res));

router.get("/:id", (req, res) => controller.getImport(req, res));
router.get("/:id/findings", (req, res) => controller.listFindings(req, res));
router.get("/:id/compare", (req, res) => controller.compare(req, res));
router.get("/:id/report/data", endpointRateLimitMiddleware("report"), (req, res) => controller.getReportData(req, res));

export { router as codeScanRoutes };
