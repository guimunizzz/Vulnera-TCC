import { Router } from "express";
import { authRateLimitMiddleware } from "../middlewares/rate-limit.middleware";
import { makeUserController } from "../factories/user.factory";

const router = Router();
const controller = makeUserController();

router.use(authRateLimitMiddleware); // protege e limita tudo abaixo

// IMPORTANTE: /me precisa vir antes de /:id
router.get("/me", controller.me);
router.get("/", controller.list);
router.get("/:id", controller.getById);
router.patch("/:id", controller.update);
router.delete("/:id", controller.delete);

export { router as userRoutes };
