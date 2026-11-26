/**
 * threat-intel.worker.ts
 *
 * Consumidor da fila `threat-intel` no motor bullmq (ADR-056 §5, Fase 3).
 *
 *   - Concorrência 1: substitui a flag "rodando" do processo. Manual, backfill
 *     e agendado esperam a vez em vez de se atropelar.
 *   - O agendamento é um job scheduler de id FIXO (`threat-intel-sync`): o
 *     upsert a cada boot não duplica, e o próximo disparo sobrevive a restart
 *     da API (fica no Redis). Com THREAT_INTEL_SYNC_ENABLED=false o scheduler
 *     é removido — o botão "Sincronizar agora" continua funcionando.
 *   - Retry só para falha transitória (ver `ehFalhaTransitoria`); o resto vira
 *     UnrecoverableError e falha de vez (https://docs.bullmq.io/patterns/stop-retrying-jobs).
 *
 * O ThreatIntelSyncService é o mesmo do motor memory: a fila só muda QUEM
 * chama `executar`, não o que a sincronização faz.
 */

import { Queue, UnrecoverableError, Worker, type ConnectionOptions, type Job } from "bullmq";
import { FonteIndisponivel } from "../../threat-intel/fontes";
import type { ResumoExecucao, ThreatIntelSyncService } from "../../threat-intel/threat-intel-sync.service";
import { OPCOES_JOB_THREAT_INTEL } from "../bullmq-job-queue";
import { QUEUE_NAMES, type GatilhoThreatIntel, type ThreatIntelJobData } from "../job-queue";

export const ID_SCHEDULER_THREAT_INTEL = "threat-intel-sync";
/** Mesmo piso do agendador em memória (ADR-053): o NVD sem chave não aguenta menos. */
export const INTERVALO_MINIMO_MIN = 15;
const GATILHOS: readonly GatilhoThreatIntel[] = ["SCHEDULED", "MANUAL", "ASSET"];
const MAX_ASSET_IDS = 500;

export interface ConfigThreatIntel {
  habilitado: boolean;
  intervaloMin: number;
}

/**
 * Falha que vale tentar de novo: fonte externa fora do ar, banco/rede
 * momentaneamente indisponíveis. Bug, dado inválido e afins não melhoram
 * com retry.
 */
export function ehFalhaTransitoria(err: unknown): boolean {
  if (err instanceof FonteIndisponivel) return true;
  const e = err as { name?: unknown; code?: unknown } | null;
  if (e?.name === "PrismaClientInitializationError") return true;
  const code = typeof e?.code === "string" ? e.code : "";
  // P1001/P1002: banco inalcançável ou sem resposta; P1008: timeout; P1017: conexão fechada; P2024: pool esgotado.
  if (["P1001", "P1002", "P1008", "P1017", "P2024"].includes(code)) return true;
  return ["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "EAI_AGAIN", "EPIPE"].includes(code);
}

/** Payload vem do Redis: confere antes de usar (só gatilho conhecido e ids em texto). */
export function validarPayload(data: unknown): ThreatIntelJobData {
  const d = data as Partial<ThreatIntelJobData> | null;
  if (!d || !GATILHOS.includes(d.trigger as GatilhoThreatIntel)) throw new UnrecoverableError("payload inválido: trigger");
  if (d.assetIds !== undefined) {
    if (!Array.isArray(d.assetIds) || d.assetIds.length > MAX_ASSET_IDS || !d.assetIds.every((id) => typeof id === "string" && id.length > 0 && id.length <= 64)) {
      throw new UnrecoverableError("payload inválido: assetIds");
    }
  }
  return { trigger: d.trigger as GatilhoThreatIntel, ...(d.assetIds ? { assetIds: d.assetIds } : {}) };
}

/** O que o processor faz com um job; exportado para teste sem Redis. */
export async function processarJobThreatIntel(
  sync: Pick<ThreatIntelSyncService, "executar">,
  data: unknown,
): Promise<{ pulada: true } | ResumoExecucao> {
  const { trigger, assetIds } = validarPayload(data);
  let resumo: ResumoExecucao | null;
  try {
    resumo = await sync.executar(trigger, assetIds);
  } catch (err) {
    if (ehFalhaTransitoria(err)) throw err;
    throw new UnrecoverableError(err instanceof Error ? err.message : String(err));
  }
  // null = outra execução RUNNING no banco (outro processo); a próxima janela cobre.
  if (!resumo) return { pulada: true };
  // Todas as fontes fora (FAILED): externo e transitório por natureza → retry com backoff.
  // PARTIAL não repete: refazer as fontes que funcionaram só gastaria cota do NVD.
  if (resumo.status === "FAILED") throw new Error(`todas as fontes falharam (ThreatSyncRun ${resumo.id})`);
  return resumo;
}

/** Garante (ou remove) o scheduler de id fixo. Idempotente. */
export async function reconciliarAgendamentoThreatIntel(fila: Queue, config: ConfigThreatIntel): Promise<"agendado" | "removido"> {
  if (!config.habilitado) {
    await fila.removeJobScheduler(ID_SCHEDULER_THREAT_INTEL);
    return "removido";
  }
  const minutos = Math.max(INTERVALO_MINIMO_MIN, Number.isFinite(config.intervaloMin) ? config.intervaloMin : 360);
  await fila.upsertJobScheduler(
    ID_SCHEDULER_THREAT_INTEL,
    { every: minutos * 60_000 },
    { name: "sync", data: { trigger: "SCHEDULED" } satisfies ThreatIntelJobData, opts: OPCOES_JOB_THREAT_INTEL },
  );
  return "agendado";
}

export async function iniciarWorkerThreatIntel(
  conexao: ConnectionOptions,
  filaProdutor: Queue,
  sync: Pick<ThreatIntelSyncService, "executar" | "encerrarExecucoesInterrompidas">,
  config: ConfigThreatIntel,
): Promise<Worker> {
  const interrompidas = await sync.encerrarExecucoesInterrompidas();
  if (interrompidas > 0) console.log(`🛰️  Threat Intel: ${interrompidas} execução(ões) interrompida(s) por reinício marcada(s) como FAILED`);

  const estado = await reconciliarAgendamentoThreatIntel(filaProdutor, config);
  console.log(
    estado === "agendado"
      ? `🛰️  Threat Intel: agendada no BullMQ a cada ${Math.max(INTERVALO_MINIMO_MIN, config.intervaloMin)} min (scheduler ${ID_SCHEDULER_THREAT_INTEL})`
      : "🛰️  Threat Intel: agendamento desligado (THREAT_INTEL_SYNC_ENABLED=false)",
  );

  const worker = new Worker(QUEUE_NAMES.threatIntel, (job: Job) => processarJobThreatIntel(sync, job.data), { connection: conexao, concurrency: 1 });
  worker.on("completed", (job, r: { pulada?: boolean } & Partial<ResumoExecucao>) => {
    if (r?.pulada) console.log(`🛰️  Threat Intel: job ${job.id} (${job.data?.trigger}) pulado — já havia execução em andamento`);
    else console.log(`🛰️  Threat Intel: ${r?.status} (${job.data?.trigger}) · ${r?.newAdvisories} avisos novos · ${r?.newMatches} casamentos · ${r?.notifications} notificações`);
  });
  worker.on("failed", (job, err) => {
    const tentativas = job ? `${job.attemptsMade}/${job.opts.attempts ?? 1}` : "?";
    console.error(`🛰️  Threat Intel: job ${job?.id} (${job?.data?.trigger}) falhou na tentativa ${tentativas} — ${err.message}`);
  });
  // Sem listener, erro de conexão vira "unhandled error event".
  worker.on("error", (err) => console.error(`[worker] ${QUEUE_NAMES.threatIntel}: ${err.message}`));
  return worker;
}
