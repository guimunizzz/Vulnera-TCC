import { Router } from "express";
import { makeProjectMemberController } from "../factories/project-member.factory";
import { requireRole } from "../middlewares/require-role.middleware";

// mergeParams: precisa herdar :projectId do router pai (project.routes.ts).
// authMiddleware já rodou no router pai. GET é visível a quem pode ver o
// Project (checado no service); só POST/DELETE (gestão) exigem ADMIN.
const router = Router({ mergeParams: true });
const controller = makeProjectMemberController();

router.get("/", (req, res) => controller.list(req, res));
router.post("/", requireRole("ADMIN"), (req, res) => controller.add(req, res));
router.delete("/:userId", requireRole("ADMIN"), (req, res) => controller.remove(req, res));

export { router as projectMemberRoutes };
