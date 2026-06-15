import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { makeUserController } from "../factory/user.factory";

const router = Router();
const controller = makeUserController();

router.use(authMiddleware); // protege tudo abaixo

// IMPORTANTE: /me precisa vir antes de /:id
router.get("/me", controller.me);
router.get("/", controller.list);
router.get("/:id", controller.getById);
router.patch("/:id", controller.update);
router.delete("/:id", controller.delete);

export { router as userRoutes };
