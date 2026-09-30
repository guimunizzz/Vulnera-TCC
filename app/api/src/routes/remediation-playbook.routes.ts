/**
 * remediation-playbook.routes.ts
 *
 * Endpoints do catálogo de remediação (CP-5).
 *
 * LEITURA: qualquer usuário autenticado. O System é global por definição e o
 * custom é recortado pela empresa do ator dentro do repository (o filtro de
 * tenancy está no WHERE, não em um `.filter()` depois da query).
 *
 * ESCRITA: ADMIN e PENTESTER. CLIENT é read-only aqui (docs/DECISIONS.md D5) —
 * playbook é conhecimento técnico de remediação e é a maior superfície de XSS
 * armazenado do produto; a regra fina (System imutável, dono do custom) fica
 * no service.
 *
 * ⚠️ NÃO existe rota de sync com a OWASP. O sync é CLI:
 * `npm run sync:owasp-playbooks`.
 */

import { Router } from "express";
import { makeRemediationPlaybookController } from "../factories/remediation-playbook.factory";
import { authRateLimitMiddleware } from "../middlewares/rate-limit.middleware";
import { requireRole } from "../middlewares/require-role.middleware";

const router = Router();
const controller = makeRemediationPlaybookController();

router.use(authRateLimitMiddleware);

// Rota literal antes da paramétrica: senão "/for-category" cairia em "/:id".
router.get("/for-category/:owaspCategory", (req, res) => controller.forCategory(req, res));
router.get("/", (req, res) => controller.list(req, res));
router.get("/:id", (req, res) => controller.getById(req, res));

router.post("/", requireRole("ADMIN", "PENTESTER"), (req, res) => controller.create(req, res));
router.post("/:id/clone", requireRole("ADMIN", "PENTESTER"), (req, res) => controller.clone(req, res));
router.put("/:id", requireRole("ADMIN", "PENTESTER"), (req, res) => controller.update(req, res));
router.delete("/:id", requireRole("ADMIN", "PENTESTER"), (req, res) => controller.delete(req, res));

export { router as remediationPlaybookRoutes };
