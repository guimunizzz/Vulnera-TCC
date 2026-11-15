// app/api/src/routes/threat-intel.routes.ts
//
// Threat Intel (ADR-053). Autenticação no router inteiro e os três papéis
// entram: quem pode o quê em cada empresa (ver, editar inventário, triar,
// promover, sincronizar) é decidido no service, que conhece a empresa do
// recurso. Rotas literais antes das paramétricas (A5).

import { Router } from "express";
import { makeThreatIntelController } from "../factories/threat-intel.factory";
import { authRateLimitMiddleware, endpointRateLimitMiddleware } from "../middlewares/rate-limit.middleware";

const router = Router();
const controller = makeThreatIntelController();

router.use(authRateLimitMiddleware);

router.get("/companies", controller.companies);
router.get("/overview", controller.overview);
router.get("/feed", controller.feed);

router.get("/assets", controller.listAssets);
router.post("/assets", controller.addAsset);
// Consulta o NVD (limite público de 5 a cada 30 s): política "expensive".
router.get("/assets/search-products", endpointRateLimitMiddleware("expensive"), controller.searchProducts);
router.post("/assets/confirm-all", controller.confirmAll);
router.post("/assets/:id/confirm", controller.confirmAsset);
router.post("/assets/:id/dismiss", controller.dismissAsset);
router.delete("/assets/:id", controller.removeAsset);

router.get("/matches", controller.listMatches);
router.patch("/matches/:id/triage", controller.triage);
router.get("/matches/:id/promotion-draft", controller.promotionDraft);
router.post("/matches/:id/promote", controller.promote);

router.get("/sync", controller.syncStatus);
router.post("/sync", endpointRateLimitMiddleware("expensive"), controller.syncNow);

export { router as threatIntelRoutes };
