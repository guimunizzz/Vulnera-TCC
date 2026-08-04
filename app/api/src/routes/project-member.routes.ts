import { Router } from "express";
import { makeProjectMemberController } from "../factories/project-member.factory";
import { requireRole } from "../middlewares/require-role.middleware";

// mergeParams: precisa herdar :projectId do router pai (project.routes.ts).
// authMiddleware já rodou no router pai — aqui só falta o gate de role.
const router = Router({ mergeParams: true });
const controller = makeProjectMemberController();

router.use(requireRole("ADMIN"));

router.get("/", (req, res) => controller.list(req, res));
router.post("/", (req, res) => controller.add(req, res));
router.delete("/:userId", (req, res) => controller.remove(req, res));

export { router as projectMemberRoutes };
