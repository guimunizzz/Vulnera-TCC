/**
 * saved-query.routes.ts
 *
 * Buscas salvas e watchlists (CP-6).
 *
 * Sem `requireRole`: os TRÊS papéis salvam buscas — inclusive o CLIENT, que
 * acompanha o próprio risco. A distinção que existe é de ESCOPO, não de papel,
 * e ela mora no service: PENTESTER só cria busca privada, porque ele atravessa
 * empresas e "compartilhar com a empresa" não teria destinatário definido.
 */

import { Router } from "express";
import { makeSavedQueryController } from "../factories/saved-query.factory";
import { authRateLimitMiddleware } from "../middlewares/rate-limit.middleware";

const router = Router();
const controller = makeSavedQueryController();

router.use(authRateLimitMiddleware);

router.get("/", (req, res) => controller.list(req, res));
router.get("/:id", (req, res) => controller.getById(req, res));
router.post("/", (req, res) => controller.create(req, res));
router.put("/:id", (req, res) => controller.update(req, res));
router.delete("/:id", (req, res) => controller.delete(req, res));

export { router as savedQueryRoutes };
