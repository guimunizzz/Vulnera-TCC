/**
 * job-queue.ts
 *
 * Contrato pequeno da fila de jobs do Vulnera (ADR-056). Dois motores,
 * escolhidos por `QUEUE_DRIVER` na factory (`factories/job-queue.factory.ts`):
 *
 *   - memory: o comportamento de sempre — fila DAST no watchdog em memória
 *     (ADR-031) e `setInterval` da Threat Intel (ADR-053). É o padrão e o
 *     caminho de rollback.
 *   - bullmq: fila persistente no Redis, consumida por `src/worker.ts`.
 *
 * O contrato cresce fase a fase, só com o que os dois motores implementam de
 * verdade (sem método que um deles não saiba cumprir): motor e conexão
 * (Fase 2), Threat Intel (Fase 3), DAST (Fase 4); agendamentos na Fase 5.
 *
 * Regra de payload (ADR-056 §3): jobs levam SÓ ids. O worker recarrega tudo
 * do banco — nada de URL, token ou segredo no Redis.
 */

import type { WatchdogRunContext } from "../dast-watchdog.service";

export type QueueDriver = "memory" | "bullmq";

/** Nomes das filas no Redis, um por assunto (ADR-056 §1). */
export const QUEUE_NAMES = {
  dastScan: "dast-scan",
  threatIntel: "threat-intel",
  dastSchedule: "dast-schedule",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

/** Gatilhos da Threat Intel, os mesmos do `ThreatSyncRun.trigger` (ADR-053). */
export type GatilhoThreatIntel = "SCHEDULED" | "MANUAL" | "ASSET";

/** Payload da fila `threat-intel`: só o gatilho e, no backfill, ids de TechAsset. */
export interface ThreatIntelJobData {
  trigger: GatilhoThreatIntel;
  assetIds?: string[];
}

/** Payload da fila `dast-scan`: só o id. O worker recarrega o scan do banco. */
export interface DastScanJobData {
  scanId: string;
}

/**
 * Pedido de execução de um scan. `run` e os campos descritivos servem só ao
 * motor memory (o watchdog executa o closure no próprio processo); o motor
 * bullmq manda ao Redis apenas `{ scanId }`.
 */
export interface PedidoScanDast {
  scanId: string;
  targetUrl: string;
  requestedById: string;
  run: (ctx: WatchdogRunContext) => Promise<void>;
}

/** Payload da fila `dast-schedule`: só o id do agendamento. */
export interface DastScheduleJobData {
  scheduleId: string;
}

/** O que o Redis precisa espelhar de um ScanSchedule habilitado (padrão já gerado no servidor). */
export interface AgendamentoDastDesejado {
  scheduleId: string;
  pattern: string;
  timezone: string;
}

/** Um scan esperando a vez, na ordem em que vai entrar. */
export interface ScanNaFila {
  scanId: string;
  queuedAt: string;
}

export interface JobQueue {
  readonly driver: QueueDriver;
  /**
   * DAST (Fase 4). Devolve a posição na fila: 0 = começa agora (há vaga).
   * bullmq: `jobId = scanId`, então enfileirar duas vezes não duplica.
   */
  enfileirarDastScan(pedido: PedidoScanDast): Promise<number>;
  /**
   * Tira da fila um scan que ainda não começou. Scan já em execução não sai
   * por aqui (o BullMQ não remove job ativo): quem o para é o abort do
   * watchdog + `docker rm -f`. memory: no-op — o `watchdog.abort` do
   * cancelamento já cobre a fila em memória.
   */
  removerDastScanDaFila(scanId: string): Promise<boolean>;
  /** Scans esperando a vez, na ordem de entrada. Alimenta o banner da tela DAST. */
  dastNaFila(): Promise<ScanNaFila[]>;
  /**
   * Agendamentos DAST (Fase 5): espelha no Redis o conjunto de agendamentos
   * habilitados (upsert dos desejados, remoção dos que sobraram). Idempotente.
   * memory: NÃO há execução agendada nesse motor — devolve null e quem chamou
   * registra isso; o CRUD continua funcionando.
   */
  aplicarAgendamentosDast(desejados: AgendamentoDastDesejado[]): Promise<{ upserts: number; removidos: number } | null>;
  /**
   * Próximo disparo de cada agendamento (scheduleId → ISO), lido do próprio
   * scheduler. memory: null — sem relógio, não há próximo disparo para mostrar.
   */
  proximasExecucoesDast(): Promise<Map<string, string> | null>;
  /**
   * Threat Intel (Fase 3): sincronização manual ou backfill de tecnologias.
   * memory: dispara no próprio processo, em segundo plano, como sempre.
   * bullmq: vira job na fila `threat-intel` (concorrência 1 no worker).
   */
  enfileirarThreatIntel(dados: ThreatIntelJobData): Promise<void>;
  /** Há sincronização rodando ou esperando a vez? Alimenta o "sincronizando" da tela. */
  threatIntelEmAndamento(): Promise<boolean>;
  /**
   * Prova que o motor está utilizável. memory: nada a provar. bullmq: uma ida
   * e volta autenticada ao Redis — rejeita com a causa (senha errada, Redis
   * fora do ar) em vez de ficar tentando para sempre em silêncio.
   */
  verificarConexao(): Promise<void>;
  /** Fecha conexões. Idempotente. */
  close(): Promise<void>;
}

/** Lê o driver; valor desconhecido é erro de configuração, não silêncio. */
export function parseQueueDriver(raw: string | undefined): QueueDriver {
  const value = (raw ?? "").trim().toLowerCase();
  if (value === "" || value === "memory") return "memory";
  if (value === "bullmq") return "bullmq";
  throw new Error(`QUEUE_DRIVER inválido: "${raw}". Use "memory" ou "bullmq".`);
}
