import { app } from "./app";
import { EnvVar } from "./config/EnvVar";
import { EnvKeys } from "./config/enum/EnvKeys";
import { makeDastScanService } from "./factories/dast-scan.factory";

const port = EnvVar.getNumber(EnvKeys.PORT);

// Watchdog do módulo DAST: todo scan QUEUED/RUNNING no momento do boot só
// pode ser órfão de um reinício anterior (não há fila nem processo
// sobrevivente rodando aquele container) — marca FAILED antes de aceitar
// tráfego. Sem isso, um restart no meio de um scan deixaria o registro
// pendurado pra sempre (ver dast-scan.service.ts).
makeDastScanService()
  .recoverOrphanedScans()
  .then((count) => {
    if (count > 0) console.log(`⚠️  Watchdog DAST: ${count} scan(s) órfão(s) marcado(s) como FAILED`);
  })
  .catch((err) => console.error("Watchdog DAST falhou ao rodar no boot", err));

app.listen(port, () => {
  console.log(`🚀 Vulnera API rodando em http://localhost:${port}`);
});
