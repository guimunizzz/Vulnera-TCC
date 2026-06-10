import { Router } from "express";
import { makePlanController } from "../factory/plan.factory";

// TODO Sprint 2 (KAN-202): aplicar authMiddleware quando estiver disponível
// import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();
const controller = makePlanController();

// router.use(authMiddleware);

router.get("/", (req, res) => controller.list(req, res));
router.get("/:id", (req, res) => controller.getById(req, res));
router.post("/", (req, res) => controller.create(req, res));
router.put("/:id", (req, res) => controller.update(req, res));
router.delete("/:id", (req, res) => controller.delete(req, res));

export { router as planRoutes };
