import { app } from "./app";
import { EnvVar } from "./config/EnvVar";
import { EnvKeys } from "./config/enum/EnvKeys";
import { makeDastScanService } from "./factories/dast-scan.factory";
import { makeThreatIntelSyncService } from "./factories/threat-intel.factory";
import { iniciarAgendador } from "./services/threat-intel/agendador";

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

// Threat Intel (ADR-053): sincronização periódica com NVD, OSV, CISA KEV e EPSS.
// Só aqui, nunca no app.ts: os testes importam o app e não podem ligar o relógio.
if (EnvVar.getOptional(EnvKeys.THREAT_INTEL_SYNC_ENABLED, "true") !== "false") {
  iniciarAgendador(makeThreatIntelSyncService(), Number(EnvVar.getOptional(EnvKeys.THREAT_INTEL_SYNC_INTERVAL_MIN, "360")) || 360);
}

app.listen(port, () => {
  console.log(`🚀 Vulnera API rodando em http://localhost:${port}`);
});
