import { app } from "./app";
import { EnvVar } from "./config/EnvVar";
import { EnvKeys } from "./config/enum/EnvKeys";

const port = EnvVar.getNumber(EnvKeys.PORT);
app.listen(port, () => {
  console.log(`🚀 Vulnera API rodando em http://localhost:${port}`);
});
