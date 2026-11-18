/**
 * dast-scan.worker.ts
 *
 * Consumidor da fila `dast-scan` no motor bullmq (ADR-056 §4, Fase 4).
 *
 *   - Concorrência = DAST_MAX_CONCURRENT_SCANS (o mesmo teto do watchdog).
 *     Os limites de CPU/RAM de cada ZAP não mudam (zap-runner).
 *   - O job só leva `{ scanId }`; o service recarrega o scan e só roda se ele
 *     ainda estiver QUEUED (tomada atômica). Job repetido ou scan cancelado
 *     não executa.
 *   - `maxStalledCount: 0`: com o worker dentro da API, um job "stalled" quer
 *     dizer que o processo morreu e o container ZAP ficou órfão. Devolver o
 *     job à fila (padrão 1 do BullMQ) não ajudaria — o scan já saiu de QUEUED.
 *     O job vai direto para failed e o boot dá o veredito no banco.
 *   - `attempts: 1` (nas opções do job): sem retry automático contra o alvo.
 *
 * Antes de consumir, o boot reconcilia banco × Redis (`recuperarParaFila`):
 * RUNNING vira FAILED (container morto), QUEUED sobrevive e volta à fila se
 * o job tiver sumido.
 */

import { UnrecoverableError, Worker, type ConnectionOptions, type Job } from "bullmq";
import type { DastScanService } from "../../dast-scan.service";
import { QUEUE_NAMES, type DastScanJobData } from "../job-queue";

export function validarPayloadDast(data: unknown): DastScanJobData {
  const d = data as Partial<DastScanJobData> | null;
  if (!d || typeof d.scanId !== "string" || d.scanId.length === 0 || d.scanId.length > 64) {
    throw new UnrecoverableError("payload inválido: scanId");
  }
  return { scanId: d.scanId };
}

export function iniciarWorkerDast(
  conexao: ConnectionOptions,
  service: Pick<DastScanService, "processarDaFila" | "marcarFalhaDaFila">,
  concorrencia: number,
): Worker {
  const worker = new Worker(
    QUEUE_NAMES.dastScan,
    async (job: Job) => {
      const { scanId } = validarPayloadDast(job.data);
      return { scanId, resultado: await service.processarDaFila(scanId) };
    },
    { connection: conexao, concurrency: Math.max(1, concorrencia), maxStalledCount: 0 },
  );
  worker.on("failed", (job, err) => {
    const scanId = typeof job?.data?.scanId === "string" ? job.data.scanId : null;
    console.error(`[DAST fila] job ${job?.id} falhou — ${err.message}`);
    // Scan que nunca começou não pode ficar QUEUED para sempre (ver marcarFalhaDaFila).
    if (scanId) void service.marcarFalhaDaFila(scanId, err.message).catch((e) => console.error("[DAST fila] não marcou a falha", e));
  });
  worker.on("error", (err) => console.error(`[worker] ${QUEUE_NAMES.dastScan}: ${err.message}`));
  return worker;
}
