import { Router } from "express";
import { makeProjectController } from "../factories/project.factory";
import { makeReportController } from "../factories/report.factory";
import { authMiddleware } from "../middlewares/auth.middleware";
import { projectMemberRoutes } from "./project-member.routes";

const router = Router();
const controller = makeProjectController();
// report-data é lógica do recurso Report (report.service), mas a URL exigida
// pelo enunciado da Fase 6 é aninhada em /projects/:id — por isso o
// controller é montado aqui em vez de em report.routes.ts.
const reportController = makeReportController();

router.use(authMiddleware);

router.get("/", (req, res) => controller.list(req, res));
router.get("/:id", (req, res) => controller.getById(req, res));
router.get("/:id/report-data", (req, res) => reportController.getReportData(req, res));
router.post("/", (req, res) => controller.create(req, res));
router.put("/:id", (req, res) => controller.update(req, res));
router.post("/:id/transition", (req, res) => controller.transition(req, res));

// subrota: /projects/:projectId/members
router.use("/:projectId/members", projectMemberRoutes);

export { router as projectRoutes };
