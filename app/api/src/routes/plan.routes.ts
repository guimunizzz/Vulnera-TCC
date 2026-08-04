import { Router } from "express";
import { makePlanController } from "../factories/plan.factory";
import { authMiddleware } from "../middlewares/auth.middleware";
import { requireRole } from "../middlewares/require-role.middleware";

const router = Router();
const controller = makePlanController();

// catálogo público
router.get("/", (req, res) => controller.list(req, res));
router.get("/:id", (req, res) => controller.getById(req, res));

// gestão restrita a admin
router.post("/", authMiddleware, requireRole("ADMIN"), (req, res) =>
  controller.create(req, res),
);
router.put("/:id", authMiddleware, requireRole("ADMIN"), (req, res) =>
  controller.update(req, res),
);
router.delete("/:id", authMiddleware, requireRole("ADMIN"), (req, res) =>
  controller.delete(req, res),
);

export { router as planRoutes };
