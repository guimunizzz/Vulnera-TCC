import { Router } from "express";
import { makeNotificationController } from "../factories/notification.factory";
import { authRateLimitMiddleware } from "../middlewares/rate-limit.middleware";

const router = Router();
const controller = makeNotificationController();

router.use(authRateLimitMiddleware);

router.post("/register-push", (req, res) => controller.registerPush(req, res));

export { router as notificationRoutes };
