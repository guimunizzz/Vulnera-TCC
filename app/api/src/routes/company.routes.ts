import { Router } from "express";
import { makeCompanyController } from "../factories/company.factory";
import { makeMetricsController } from "../factories/metrics.factory";
import { makeSlaPolicyController } from "../factories/sla-policy.factory";
import { authMiddleware } from "../middlewares/auth.middleware";
import { requireRole } from "../middlewares/require-role.middleware";

const router = Router();
const controller = makeCompanyController();
const metricsController = makeMetricsController();
// Política de SLA (CP-2) mora numa sub-rota de Company pela mesma razão das
// métricas: a URL é aninhada (é governança DA empresa), mas o recurso é outro.
const slaPolicyController = makeSlaPolicyController();

router.use(authMiddleware);

// rota literal ANTES de paramétrica
router.get("/me/metrics/comparison", (req, res) => metricsController.comparison(req, res));
router.get("/me", (req, res) => controller.me(req, res));

// SLA — sub-rotas de /:id, ANTES de "/:id" por consistência (CLAUDE.md §5.6).
// RBAC fino (ADMIN qualquer / CLIENT a própria / OWNER define / só ADMIN
// reaplica) mora no service — aqui só a autenticação.
router.get("/:id/sla-policy", (req, res) => slaPolicyController.get(req, res));
router.get("/:id/sla-policy/history", (req, res) => slaPolicyController.history(req, res));
router.put("/:id/sla-policy", (req, res) => slaPolicyController.upsert(req, res));
router.post("/:id/sla-policy/apply", requireRole("ADMIN"), (req, res) => slaPolicyController.apply(req, res));

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
