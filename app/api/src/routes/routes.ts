import { Router } from "express";
import { planRoutes } from "./plan.routes";
import { companyRoutes } from "./company.routes";

const router = Router();

router.use("/plans", planRoutes);
router.use("/companies", companyRoutes);

export { router as apiRoutes };
