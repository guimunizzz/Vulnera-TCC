// Rotas públicas de autenticação — SEM authMiddleware.
import { Router } from "express";
import { makeAuthController } from "../factories/auth.factory";
import {
  loginRateLimitMiddleware,
  refreshRateLimitMiddleware,
} from "../middlewares/rate-limit.middleware";

const router = Router();
const controller = makeAuthController();

router.post("/login", loginRateLimitMiddleware, controller.login);
router.post("/refresh", refreshRateLimitMiddleware, controller.refresh);
router.post("/logout", controller.logout);

export { router as authRoutes };
