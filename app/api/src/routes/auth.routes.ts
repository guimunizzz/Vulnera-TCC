// Rotas públicas de autenticação — SEM authMiddleware.
import { Router } from "express";
import { makeAuthController } from "../factories/auth.factory";

const router = Router();
const controller = makeAuthController();

router.post("/register", controller.register);
router.post("/login", controller.login);
router.post("/refresh", controller.refresh);
router.post("/logout", controller.logout);

export { router as authRoutes };
