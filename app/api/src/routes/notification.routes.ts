import { Router } from "express";
import { makeNotificationController } from "../factories/notification.factory";
import { authRateLimitMiddleware } from "../middlewares/rate-limit.middleware";

const router = Router();
const controller = makeNotificationController();

router.use(authRateLimitMiddleware);

router.post("/register-push", (req, res) => controller.registerPush(req, res));

// Central in-app (ADR-053). Rotas literais antes de "/:id" (A5).
router.get("/", (req, res) => controller.list(req, res));
router.get("/unread-count", (req, res) => controller.unreadCount(req, res));
router.post("/read-all", (req, res) => controller.markAllRead(req, res));
router.post("/:id/read", (req, res) => controller.markRead(req, res));

export { router as notificationRoutes };
