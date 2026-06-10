import { Router } from "express";
import { makeCompanyController } from "../factory/company.factory";

// TODO Sprint 2 (KAN-202): aplicar authMiddleware quando estiver disponível
// import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();
const controller = makeCompanyController();

// router.use(authMiddleware);

router.get("/", (req, res) => controller.list(req, res));
router.get("/:id", (req, res) => controller.getById(req, res));
router.post("/", (req, res) => controller.create(req, res));
router.put("/:id", (req, res) => controller.update(req, res));
router.delete("/:id", (req, res) => controller.delete(req, res));

export { router as companyRoutes };
