/**
 * sla-monitor.worker.ts
 *
 * Consumidor da fila `sla-monitor` no motor bullmq (ADR-056, FILA-FUT-02).
 *
 *   - Agendamento diário: job scheduler de id FIXO (`sla-monitor-daily`), padrão
 *     cron 08:00 no fuso de São Paulo. O upsert a cada boot não duplica, e o próximo
 *     disparo sobrevive a restart (fica no Redis). Com SLA_MONITOR_ENABLED=false o
 *     scheduler é removido.
 *   - Concorrência 1 e payload vazio: o monitor lê o banco inteiro, não recebe ids.
 *   - Retry só para falha transitória (mesma classificação da Threat Intel). Repetir
 *     é seguro: a deduplicação do monitor impede aviso em dobro.
 */

import { UnrecoverableError, Worker, type ConnectionOptions, type JobsOptions, type Queue } from "bullmq";
import type { ResumoSlaMonitor, SlaMonitorService } from "../../sla-monitor.service";
import { QUEUE_NAMES, type SlaMonitorJobData } from "../job-queue";
import { ehFalhaTransitoria } from "./threat-intel.worker";

export const ID_SCHEDULER_SLA_MONITOR = "sla-monitor-daily";
/** 08:00 todos os dias, no horário de Brasília. */
export const PADRAO_SLA_MONITOR = "0 8 * * *";
export const FUSO_SLA_MONITOR = "America/Sao_Paulo";

/** Mesma política de retry da Threat Intel (ADR-056 §5): 3 tentativas, backoff exponencial de 1 min. */
export const OPCOES_JOB_SLA_MONITOR: JobsOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 60_000 },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 50 },
};

export interface ConfigSlaMonitor {
  habilitado: boolean;
}

type FilaDeAgendamento = Pick<Queue, "upsertJobScheduler" | "removeJobScheduler">;

/** Garante (ou remove) o scheduler diário de id fixo. Idempotente. */
export async function reconciliarAgendamentoSlaMonitor(fila: FilaDeAgendamento, config: ConfigSlaMonitor): Promise<"agendado" | "removido"> {
  if (!config.habilitado) {
    await fila.removeJobScheduler(ID_SCHEDULER_SLA_MONITOR);
    return "removido";
  }
  await fila.upsertJobScheduler(
    ID_SCHEDULER_SLA_MONITOR,
    { pattern: PADRAO_SLA_MONITOR, tz: FUSO_SLA_MONITOR },
    { name: "monitor", data: {} satisfies SlaMonitorJobData, opts: OPCOES_JOB_SLA_MONITOR },
  );
  return "agendado";
}

/** O que o processor faz com um job; exportado para teste sem Redis. */
export async function processarJobSlaMonitor(monitor: Pick<SlaMonitorService, "executar">): Promise<ResumoSlaMonitor> {
  try {
    return await monitor.executar();
  } catch (err) {
    if (ehFalhaTransitoria(err)) throw err;
    throw new UnrecoverableError(err instanceof Error ? err.message : String(err));
  }
}

export async function iniciarWorkerSlaMonitor(
  conexao: ConnectionOptions,
  filaProdutor: Queue,
  monitor: Pick<SlaMonitorService, "executar">,
  config: ConfigSlaMonitor,
): Promise<Worker> {
  const estado = await reconciliarAgendamentoSlaMonitor(filaProdutor, config);
  console.log(
    estado === "agendado"
      ? `⏰ Monitor de SLA: agendado no BullMQ às 08:00 (${FUSO_SLA_MONITOR}, scheduler ${ID_SCHEDULER_SLA_MONITOR})`
      : "⏰ Monitor de SLA: agendamento desligado (SLA_MONITOR_ENABLED=false)",
  );

  // Payload vazio: o processor não precisa do job.
  const worker = new Worker(QUEUE_NAMES.slaMonitor, () => processarJobSlaMonitor(monitor), { connection: conexao, concurrency: 1 });
  worker.on("completed", (_job, r: ResumoSlaMonitor) => {
    console.log(`⏰ Monitor de SLA: ${r.candidatas} vulnerabilidade(s) na janela · ${r.individuais} aviso(s) · ${r.resumos} resumo(s)`);
  });
  worker.on("failed", (job, err) => {
    const tentativas = job ? `${job.attemptsMade}/${job.opts.attempts ?? 1}` : "?";
    console.error(`⏰ Monitor de SLA: job ${job?.id} falhou na tentativa ${tentativas} — ${err.message}`);
  });
  // Sem listener, erro de conexão vira "unhandled error event".
  worker.on("error", (err) => console.error(`[worker] ${QUEUE_NAMES.slaMonitor}: ${err.message}`));
  return worker;
}
