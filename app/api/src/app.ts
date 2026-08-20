import express from "express";
import cors from "cors";
import { apiRoutes } from "./routes/routes";
import { EnvVar } from "./config/EnvVar";
import { EnvKeys } from "./config/enum/EnvKeys";

const app = express();
app.use(cors({ origin: EnvVar.getOptional(EnvKeys.CORS_ORIGIN, "http://localhost:3000"), credentials: true }));
app.use(express.json());
app.use("/api", apiRoutes);

export { app };
