import { Router } from "express";
import { makeMaturityController } from "../factories/maturity.factory";
import { authRateLimitMiddleware } from "../middlewares/rate-limit.middleware";

const router = Router();
const controller = makeMaturityController();

router.use(authRateLimitMiddleware);

// rota literal antes de paramétrica
router.get("/catalog", (req, res) => controller.getCatalog(req, res));
router.post("/assessments", (req, res) => controller.createAssessment(req, res));
router.post("/assessments/:id/scores", (req, res) => controller.submitScores(req, res));
router.get("/assessments/:companyId/latest", (req, res) => controller.getLatestByCompany(req, res));

export { router as maturityRoutes };
