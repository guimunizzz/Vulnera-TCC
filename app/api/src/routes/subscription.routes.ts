import { Router } from "express";
import { makeSubscriptionController } from "../factories/subscription.factory";
import { authRateLimitMiddleware } from "../middlewares/rate-limit.middleware";
import { requireRole } from "../middlewares/require-role.middleware";

const router = Router();
const controller = makeSubscriptionController();

router.use(authRateLimitMiddleware);

// rotas literais ANTES de paramétricas
router.get("/pending", requireRole("ADMIN"), (req, res) => controller.listPending(req, res));
router.get("/active", requireRole("ADMIN"), (req, res) => controller.listActive(req, res));
router.get("/current", (req, res) => controller.current(req, res));

router.post("/", (req, res) => controller.request(req, res));
router.post("/:id/approve", requireRole("ADMIN"), (req, res) => controller.approve(req, res));
router.post("/:id/reject", requireRole("ADMIN"), (req, res) => controller.reject(req, res));

export { router as subscriptionRoutes };
