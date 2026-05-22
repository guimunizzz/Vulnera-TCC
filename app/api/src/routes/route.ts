import { Router } from "express";
import planRouter from "./plan.routes";

const router = Router();

router.use("/plans", planRouter);

export default router;