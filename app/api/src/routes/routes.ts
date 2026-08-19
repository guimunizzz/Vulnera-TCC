import { Router } from "express";
import { planRoutes } from "./plan.routes";
import { companyRoutes } from "./company.routes";
import { healthRoutes } from "./health.routes";
import { authRoutes } from "./auth.routes";
import { userRoutes } from "./user.routes";
import { subscriptionRoutes } from "./subscription.routes";
import { applicationRoutes } from "./application.routes";
import { projectRoutes } from "./project.routes";
import { vulnerabilityRoutes } from "./vulnerability.routes";
import { reportRoutes } from "./report.routes";
import { notificationRoutes } from "./notification.routes";
import { maturityRoutes } from "./maturity.routes";

const router = Router();

router.use("/health", healthRoutes);
router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/plans", planRoutes);
router.use("/companies", companyRoutes);
router.use("/subscriptions", subscriptionRoutes);
router.use("/applications", applicationRoutes);
router.use("/projects", projectRoutes);
router.use("/vulnerabilities", vulnerabilityRoutes);
router.use("/reports", reportRoutes);
router.use("/notifications", notificationRoutes);
router.use("/maturity", maturityRoutes);

export { router as apiRoutes };
