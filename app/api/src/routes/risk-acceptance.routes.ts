// app/api/src/routes/risk-acceptance.routes.ts
//
// Rotas de DECISÃO sobre um aceite de risco (CP-4). As de LEITURA e de
// SOLICITAÇÃO vivem aninhadas em vulnerability.routes.ts, porque ali o aceite
// é um sub-recurso do finding; aqui o recurso já tem id próprio e a ação é
// sobre ele.
//
// RBAC fino (ADMIN ou CLIENT OWNER da empresa; PENTESTER nunca decide;
// solicitante não aprova o próprio pedido) mora no service — aqui só a
// autenticação. Não existe PUT: aceite decidido é imutável (D10).

import { Router } from "express";
import { makeRiskAcceptanceController } from "../factories/risk-acceptance.factory";
import { authMiddleware } from "../middlewares/auth.middleware";

const router = Router();
const controller = makeRiskAcceptanceController();

router.use(authMiddleware);

router.post("/:id/approve", (req, res) => controller.approve(req, res));
router.post("/:id/reject", (req, res) => controller.reject(req, res));
router.post("/:id/revoke", (req, res) => controller.revoke(req, res));

export { router as riskAcceptanceRoutes };
