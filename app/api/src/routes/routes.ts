import { Router } from "express";
import { planRoutes } from "./plan.routes";
import { companyRoutes } from "./company.routes";
import { healthRoutes } from "./health.routes";
import { authRoutes } from "./auth.routes";

const router = Router();

router.use("/health", healthRoutes);
router.use("/auth", authRoutes);
router.use("/plans", planRoutes);
router.use("/companies", companyRoutes);

export { router as apiRoutes };
