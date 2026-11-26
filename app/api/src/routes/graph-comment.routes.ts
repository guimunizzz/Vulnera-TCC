// Comentários fixados em nós de grafo (ADR-061). Só autenticação aqui: o acesso
// depende do grafo (company do usuário ou regra do scan DAST) e mora no service.
import { Router } from "express";
import { makeGraphCommentController } from "../factories/graph-comment.factory";
import { authRateLimitMiddleware } from "../middlewares/rate-limit.middleware";

const router = Router();
const controller = makeGraphCommentController();

router.use(authRateLimitMiddleware);

router.get("/", (req, res) => controller.listar(req, res));
router.post("/", (req, res) => controller.criar(req, res));
router.delete("/:id", (req, res) => controller.apagar(req, res));

export { router as graphCommentRoutes };
