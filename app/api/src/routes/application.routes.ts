import { Router } from "express";
import { makeApplicationController } from "../factories/application.factory";
import { authMiddleware } from "../middlewares/auth.middleware";

const router = Router();
const controller = makeApplicationController();

router.use(authMiddleware);

router.get("/", (req, res) => controller.list(req, res));
router.get("/:id", (req, res) => controller.getById(req, res));
router.post("/", (req, res) => controller.create(req, res));
router.put("/:id", (req, res) => controller.update(req, res));
router.delete("/:id", (req, res) => controller.delete(req, res));

export { router as applicationRoutes };
