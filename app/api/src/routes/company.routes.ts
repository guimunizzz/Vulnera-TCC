import { Router } from "express";
import { makeCompanyController } from "../factories/company.factory";
import { makeMetricsController } from "../factories/metrics.factory";
import { authMiddleware } from "../middlewares/auth.middleware";
import { requireRole } from "../middlewares/require-role.middleware";

const router = Router();
const controller = makeCompanyController();
const metricsController = makeMetricsController();

router.use(authMiddleware);

// rota literal ANTES de paramétrica
router.get("/me/metrics/comparison", (req, res) => metricsController.comparison(req, res));
router.get("/me", (req, res) => controller.me(req, res));

// listagem e detalhe por id: admin-only (CLIENT usa /me)
router.get("/", requireRole("ADMIN"), (req, res) => controller.list(req, res));
router.get("/:id", requireRole("ADMIN"), (req, res) => controller.getById(req, res));

// criação: qualquer autenticado (quem cria vira dono, ownership validada no service)
router.post("/", (req, res) => controller.create(req, res));

// edição: ownership fina validada no service (ADMIN edita qualquer uma, CLIENT só a própria)
router.put("/:id", (req, res) => controller.update(req, res));

// exclusão: admin-only
router.delete("/:id", requireRole("ADMIN"), (req, res) => controller.delete(req, res));

export { router as companyRoutes };
