// app/api/src/factories/job-queue.factory.ts
//
// FACTORY METHOD da fila de jobs (ADR-056)
// ----------------------------------------------------------------------------
// Escolhe o motor por QUEUE_DRIVER (padrão `memory`). É SINGLETON pelo mesmo
// motivo do watchdog do DAST: conexões ao Redis e o limite de concorrência só
// fazem sentido numa instância por processo.
//
// Só server.ts e worker.ts chamam isto. O app.ts não: os testes importam o app
// e não podem abrir conexão com o Redis nem iniciar worker (A6).
// ----------------------------------------------------------------------------

import { EnvVar } from "../config/EnvVar";
import { EnvKeys } from "../config/enum/EnvKeys";
import { parseQueueDriver, type JobQueue } from "../services/queue/job-queue";
import { MemoryJobQueue } from "../services/queue/memory-job-queue";
import { BullmqJobQueue } from "../services/queue/bullmq-job-queue";

let instancia: JobQueue | null = null;

export function makeJobQueue(): JobQueue {
  if (instancia) return instancia;
  const driver = parseQueueDriver(EnvVar.getOptional(EnvKeys.QUEUE_DRIVER, "memory"));
  // REDIS_URL é obrigatória só com bullmq: EnvVar.get falha alto se faltar.
  instancia = driver === "bullmq" ? new BullmqJobQueue(EnvVar.get(EnvKeys.REDIS_URL)) : new MemoryJobQueue();
  return instancia;
}

/** O worker sobe dentro da API, a menos que WORKER_IN_PROCESS=false (worker em processo próprio). */
export function workerNoProcessoDaApi(): boolean {
  return EnvVar.getOptional(EnvKeys.WORKER_IN_PROCESS, "true").trim().toLowerCase() !== "false";
}
