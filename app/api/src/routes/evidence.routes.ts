import { Router } from "express";
import { makeEvidenceController } from "../factories/evidence.factory";
import { uploadSingleFile } from "../middlewares/upload.middleware";

// mergeParams: precisa herdar :vulnId do router pai (vulnerability.routes.ts).
// authMiddleware já rodou no router pai — toda rota aqui exige login.
const router = Router({ mergeParams: true });
const controller = makeEvidenceController();

router.get("/", (req, res) => controller.list(req, res));
router.post("/", uploadSingleFile, (req, res) => controller.upload(req, res));
router.get("/:evidenceId", (req, res) => controller.download(req, res));

export { router as evidenceRoutes };
