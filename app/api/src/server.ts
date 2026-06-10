import express from "express";
import { apiRoutes } from "./routes/routes";
import { EnvVar } from "./config/EnvVar";
import { EnvKeys } from "./config/enum/EnvKeys";

const app = express();
app.use(express.json());
app.use("/api", apiRoutes);

const port = EnvVar.getNumber(EnvKeys.PORT);
app.listen(port, () => {
  console.log(`🚀 Vulnera API rodando em http://localhost:${port}`);
});

export { app };
