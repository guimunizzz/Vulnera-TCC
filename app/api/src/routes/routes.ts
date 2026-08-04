import { Router } from "express";
import { planRoutes } from "./plan.routes";
import { companyRoutes } from "./company.routes";
import { healthRoutes } from "./health.routes";
import { authRoutes } from "./auth.routes";
import { userRoutes } from "./user.routes";
import { subscriptionRoutes } from "./subscription.routes";

const router = Router();

router.use("/health", healthRoutes);
router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/plans", planRoutes);
router.use("/companies", companyRoutes);
router.use("/subscriptions", subscriptionRoutes);

export { router as apiRoutes };
