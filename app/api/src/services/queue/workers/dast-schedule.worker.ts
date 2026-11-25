/**
 * dast-schedule.worker.ts
 *
 * Scans DAST agendados no motor bullmq (ADR-056 §6, Fase 5).
 *
 *   - Reconciliador: o MySQL (ScanSchedule) é a fonte da verdade. Para cada
 *     agendamento habilitado, upsert do scheduler de id fixo
 *     `dast-schedule:<id>` (padrão cron + fuso gerados no servidor); scheduler
 *     `dast-schedule:*` sem linha habilitada é removido. Rodar duas vezes dá o
 *     mesmo resultado; apagar o Redis não perde nada (o boot recria).
 *   - Worker: o job `{ scheduleId }` NÃO roda o ZAP. O service reconfere tudo
 *     na execução e, se passar, cria o DastScan e o enfileira em `dast-scan`
 *     — um só caminho de execução de scan.
 */

import { UnrecoverableError, Worker, type ConnectionOptions, type Job, type JobsOptions, type Queue } from "bullmq";
import { idSchedulerDast } from "../../../utils/dast-schedule.util";
import { QUEUE_NAMES, type AgendamentoDastDesejado, type DastScheduleJobData } from "../job-queue";

const PREFIXO = "dast-schedule:";

/** attempts 1: um disparo perdido espera o próximo horário, não insiste contra o alvo. */
export const OPCOES_JOB_AGENDAMENTO: JobsOptions = {
  attempts: 1,
  removeOnComplete: { count: 200 },
  removeOnFail: { count: 200 },
};

type FilaDeAgendamento = Pick<Queue, "getJobSchedulers" | "upsertJobScheduler" | "removeJobScheduler">;

export async function reconciliarAgendamentosDast(
  fila: FilaDeAgendamento,
  desejados: AgendamentoDastDesejado[],
): Promise<{ upserts: number; removidos: number }> {
  const ids = new Set(desejados.map((d) => idSchedulerDast(d.scheduleId)));
  const existentes = await fila.getJobSchedulers(0, -1, true);
  let removidos = 0;
  for (const s of existentes) {
    const chave = String((s as { key?: string; id?: string }).key ?? (s as { id?: string }).id ?? "");
    if (chave.startsWith(PREFIXO) && !ids.has(chave)) {
      if (await fila.removeJobScheduler(chave)) removidos++;
    }
  }
  for (const d of desejados) {
    await fila.upsertJobScheduler(
      idSchedulerDast(d.scheduleId),
      { pattern: d.pattern, tz: d.timezone },
      { name: "agendado", data: { scheduleId: d.scheduleId } satisfies DastScheduleJobData, opts: OPCOES_JOB_AGENDAMENTO },
    );
  }
  return { upserts: desejados.length, removidos };
}

export function validarPayloadAgendamento(data: unknown): DastScheduleJobData {
  const d = data as Partial<DastScheduleJobData> | null;
  if (!d || typeof d.scheduleId !== "string" || d.scheduleId.length === 0 || d.scheduleId.length > 64) {
    throw new UnrecoverableError("payload inválido: scheduleId");
  }
  return { scheduleId: d.scheduleId };
}

export function iniciarWorkerAgendamentosDast(
  conexao: ConnectionOptions,
  executar: (scheduleId: string) => Promise<string>,
): Worker {
  const worker = new Worker(
    QUEUE_NAMES.dastSchedule,
    async (job: Job) => {
      const { scheduleId } = validarPayloadAgendamento(job.data);
      return { scheduleId, resultado: await executar(scheduleId) };
    },
    { connection: conexao, concurrency: 1 },
  );
  worker.on("completed", (job, r: { resultado?: string }) => console.log(`🗓️  DAST agendado ${job.data?.scheduleId}: ${r?.resultado}`));
  worker.on("failed", (job, err) => console.error(`🗓️  DAST agendado ${job?.data?.scheduleId} falhou — ${err.message}`));
  worker.on("error", (err) => console.error(`[worker] ${QUEUE_NAMES.dastSchedule}: ${err.message}`));
  return worker;
}
