import { Router } from "express";
import { makeNotificationController } from "../factories/notification.factory";
import { authMiddleware } from "../middlewares/auth.middleware";

const router = Router();
const controller = makeNotificationController();

router.use(authMiddleware);

router.post("/register-push", (req, res) => controller.registerPush(req, res));

export { router as notificationRoutes };
