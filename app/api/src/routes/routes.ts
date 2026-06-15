import { Router } from "express";
import { planRoutes } from "./plan.routes";
import { companyRoutes } from "./company.routes";
import { healthRoutes } from "./health.routes";

const router = Router();

router.use("/health", healthRoutes);
router.use("/plans", planRoutes);
router.use("/companies", companyRoutes);

export { router as apiRoutes };
