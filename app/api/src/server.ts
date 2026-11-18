import { app } from "./app";
import { EnvVar } from "./config/EnvVar";
import { EnvKeys } from "./config/enum/EnvKeys";
import { makeDastScanService } from "./factories/dast-scan.factory";
import { makeThreatIntelSyncService } from "./factories/threat-intel.factory";
import { iniciarAgendador } from "./services/threat-intel/agendador";
import { makeJobQueue, workerNoProcessoDaApi } from "./factories/job-queue.factory";
import { iniciarWorkers, encerrarAoReceberSinal } from "./worker";

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

const jobQueue = makeJobQueue();

// Threat Intel (ADR-053): sincronização periódica com NVD, OSV, CISA KEV e EPSS.
// Só aqui, nunca no app.ts: os testes importam o app e não podem ligar o relógio.
// Com bullmq (ADR-056), o relógio é o job scheduler do worker, não este setInterval.
if (jobQueue.driver === "memory" && EnvVar.getOptional(EnvKeys.THREAT_INTEL_SYNC_ENABLED, "true") !== "false") {
  iniciarAgendador(makeThreatIntelSyncService(), Number(EnvVar.getOptional(EnvKeys.THREAT_INTEL_SYNC_INTERVAL_MIN, "360")) || 360);
}

// Fila de jobs (ADR-056). Com `memory` (padrão), nada muda: watchdog e
// setInterval acima. Com `bullmq`, os workers sobem aqui, a menos que
// WORKER_IN_PROCESS=false (aí rodam em `npm run worker`). Falha de conexão
// com o Redis é logada sem derrubar a API: o ioredis segue reconectando.
if (jobQueue.driver === "bullmq" && workerNoProcessoDaApi()) {
  iniciarWorkers(jobQueue)
    .then((workers) => encerrarAoReceberSinal(() => workers.encerrar()))
    .catch((err: Error) => console.error(`🧵 Fila bullmq: os workers não iniciaram — ${err.message}`));
}

app.listen(port, () => {
  console.log(`🚀 Vulnera API rodando em http://localhost:${port}`);
});
