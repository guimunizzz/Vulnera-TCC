// app/api/src/routes/dast-scan.routes.ts
//
// Rotas do módulo DAST — TODAS exigem authMiddleware + requireRole("PENTESTER","ADMIN").
// CLIENT recebe 403 em qualquer uma: o módulo não existe pra esse role, não
// há meio-termo de visibilidade aqui (diferente de Vulnerability, que CLIENT
// lê). Ownership fina (PENTESTER só vê os próprios scans) mora no service,
// não neste arquivo — ver dast-scan.service.ts.

import { Router } from "express";
import { makeDastScanController } from "../factories/dast-scan.factory";
import { makeDastTriageController } from "../factories/dast-triage.factory";
import { authMiddleware } from "../middlewares/auth.middleware";
import { requireRole } from "../middlewares/require-role.middleware";

const router = Router();
const controller = makeDastScanController();
const triageController = makeDastTriageController();

router.use(authMiddleware, requireRole("PENTESTER", "ADMIN"));

router.post("/", (req, res) => controller.create(req, res));
router.get("/", (req, res) => controller.list(req, res));
// ⚠️ Rota literal ANTES da paramétrica: sem isto, "/status" casaria com
// "/:id" e a UI receberia SCAN_NOT_FOUND (CLAUDE.md §5.6).
router.get("/status", (req, res) => controller.getStatus(req, res));

// ⚠️ "/findings/:findingId/..." também é literal no primeiro segmento e
// PRECISA vir antes de "/:id" — senão "findings" seria lido como um scanId.
router.patch("/findings/:findingId/triage", (req, res) => triageController.triage(req, res));
router.get("/findings/:findingId/promotion-draft", (req, res) => triageController.getPromotionDraft(req, res));
router.post("/findings/:findingId/promote", (req, res) => triageController.promote(req, res));

router.get("/:id", (req, res) => controller.getById(req, res));
router.post("/:id/cancel", (req, res) => controller.cancel(req, res));
router.get("/:id/findings", (req, res) => controller.listFindings(req, res));
router.get("/:id/report/html", (req, res) => controller.getReportHtml(req, res));
router.get("/:id/report/data", (req, res) => controller.getReportData(req, res));
// Comparação: `:id` é o scan MAIS NOVO (head) e `?base=` o mais antigo.
router.get("/:id/comparable", (req, res) => triageController.listComparableScans(req, res));
router.get("/:id/compare", (req, res) => triageController.compare(req, res));

export { router as dastScanRoutes };
