/**
 * dast-watchdog.service.ts
 *
 * Guarda-corpo de execução do módulo DAST. Três responsabilidades, todas em
 * MEMÓRIA do processo (nada aqui toca Prisma — CLAUDE.md P1):
 *
 *  1. LIMITE DE CONCORRÊNCIA. No máximo `DAST_MAX_CONCURRENT_SCANS` (default
 *     2) scans REAIS ao mesmo tempo. O excedente fica numa fila FIFO e entra
 *     assim que uma vaga abre. Sem isso, cinco scans disparados juntos viram
 *     cinco containers do ZAP — cada um com uma JVM de ~1GB — e a máquina do
 *     Rafael (ou a da banca, no dia da apresentação) morre.
 *  2. DETECÇÃO DE TRAVAMENTO. O runner "pulsa" a cada poll na API do ZAP
 *     (~3s). Se um scan em execução passar `DAST_HEARTBEAT_TIMEOUT_MS` sem
 *     pulsar, o watchdog aborta e registra um alerta — sem isso um scan
 *     travado ocuparia uma das duas vagas pra sempre.
 *  3. AVISO. Todo erro/abort vira um alerta no anel de `alerts` (últimos 20)
 *     E um `console.warn`/`console.error`. O anel é o que a UI mostra no
 *     banner da tela de DAST; o console é o rastro pro log do servidor.
 *
 * Por que memória e não banco: a fila só faz sentido enquanto ESTE processo
 * vive. Um restart não deixa nada pendurado porque `recoverOrphanedScans()`
 * (dast-scan.service.ts) marca todo QUEUED/RUNNING como FAILED no boot — o
 * par watchdog-em-memória + recuperação-no-boot cobre o ciclo inteiro sem
 * introduzir uma fila de verdade (Redis/BullMQ), descartada em ADR-030 por
 * ser desproporcional ao volume do produto.
 *
 * Consumidores: `dast-scan.service.ts` (enfileira e cancela) e
 * `dast-scan.factory.ts` (injeta o singleton).
 */

import { EnvVar } from "../config/EnvVar";
import { EnvKeys } from "../config/enum/EnvKeys";

const DEFAULT_MAX_CONCURRENT = 2;
const DEFAULT_HEARTBEAT_TIMEOUT_MS = 2 * 60 * 1000; // 2min sem pulso = travado
const MONITOR_INTERVAL_MS = 5000;
const MAX_ALERTS = 20;

export type WatchdogAlertLevel = "warn" | "error";

export interface WatchdogAlert {
  at: string; // ISO
  scanId: string | null;
  level: WatchdogAlertLevel;
  message: string;
}

/** O que o job recebe pra cooperar com o watchdog. */
export interface WatchdogRunContext {
  /** Abortado quando o usuário cancela ou quando o watchdog mata um scan travado. */
  signal: AbortSignal;
  /** Chamado a cada tick de progresso — é o "estou vivo" que evita o abort por travamento. */
  heartbeat: (phase: string, percent: number) => void;
}

export interface WatchdogJob {
  scanId: string;
  targetUrl: string;
  requestedById: string;
  run: (ctx: WatchdogRunContext) => Promise<void>;
}

export interface WatchdogRunningEntry {
  scanId: string;
  targetUrl: string;
  requestedById: string;
  startedAt: string;
  lastHeartbeatAt: string;
  phase: string | null;
  percent: number;
}

export interface WatchdogQueuedEntry {
  scanId: string;
  targetUrl: string;
  requestedById: string;
  queuedAt: string;
  /** 1 = próximo a entrar. */
  position: number;
}

export interface WatchdogSnapshot {
  maxConcurrent: number;
  runningCount: number;
  queuedCount: number;
  running: WatchdogRunningEntry[];
  queued: WatchdogQueuedEntry[];
  alerts: WatchdogAlert[];
}

interface RunningSlot {
  scanId: string;
  targetUrl: string;
  requestedById: string;
  startedAt: number;
  lastHeartbeatAt: number;
  phase: string | null;
  percent: number;
  controller: AbortController;
}

interface QueuedSlot extends WatchdogJob {
  queuedAt: number;
}

export interface DastWatchdogOptions {
  maxConcurrent?: number;
  heartbeatTimeoutMs?: number;
  /** false nos testes de unidade, pra não deixar um interval vivo entre casos. */
  autoStartMonitor?: boolean;
}

export class DastWatchdog {
  private readonly running = new Map<string, RunningSlot>();
  private readonly queue: QueuedSlot[] = [];
  private readonly alerts: WatchdogAlert[] = [];
  private monitor: NodeJS.Timeout | null = null;

  readonly maxConcurrent: number;
  private readonly heartbeatTimeoutMs: number;

  constructor(options: DastWatchdogOptions = {}) {
    this.maxConcurrent = Math.max(1, options.maxConcurrent ?? readNumberEnv(EnvKeys.DAST_MAX_CONCURRENT_SCANS, DEFAULT_MAX_CONCURRENT));
    this.heartbeatTimeoutMs = Math.max(
      5000,
      options.heartbeatTimeoutMs ?? readNumberEnv(EnvKeys.DAST_HEARTBEAT_TIMEOUT_MS, DEFAULT_HEARTBEAT_TIMEOUT_MS),
    );
    if (options.autoStartMonitor !== false) this.startMonitor();
  }

  // ==========================================================================
  // Fila
  // ==========================================================================

  /**
   * Enfileira um scan. Devolve a posição na fila (0 = começou agora).
   * Idempotente por scanId: submeter duas vezes o mesmo scan não duplica.
   */
  submit(job: WatchdogJob): number {
    if (this.running.has(job.scanId) || this.queue.some((q) => q.scanId === job.scanId)) {
      return this.queuePositionOf(job.scanId) ?? 0;
    }
    this.queue.push({ ...job, queuedAt: Date.now() });
    this.pump();
    return this.queuePositionOf(job.scanId) ?? 0;
  }

  /** 1 = próximo da fila; 0 = já está rodando; null = não conhecido pelo watchdog. */
  queuePositionOf(scanId: string): number | null {
    if (this.running.has(scanId)) return 0;
    const index = this.queue.findIndex((q) => q.scanId === scanId);
    return index === -1 ? null : index + 1;
  }

  /**
   * Aborta um scan. Devolve onde ele estava:
   *  - "running": sinal de abort disparado (o runner para no próximo tick)
   *  - "queued": removido da fila antes de começar
   *  - null: o watchdog não conhece esse scan (já terminou, ou nunca passou por aqui)
   */
  abort(scanId: string, reason: string): "running" | "queued" | null {
    const slot = this.running.get(scanId);
    if (slot) {
      slot.controller.abort(reason);
      return "running";
    }
    const index = this.queue.findIndex((q) => q.scanId === scanId);
    if (index !== -1) {
      this.queue.splice(index, 1);
      return "queued";
    }
    return null;
  }

  private pump(): void {
    while (this.running.size < this.maxConcurrent && this.queue.length > 0) {
      const job = this.queue.shift();
      if (job) this.start(job);
    }
  }

  private start(job: QueuedSlot): void {
    const controller = new AbortController();
    const now = Date.now();
    const slot: RunningSlot = {
      scanId: job.scanId,
      targetUrl: job.targetUrl,
      requestedById: job.requestedById,
      startedAt: now,
      lastHeartbeatAt: now,
      phase: null,
      percent: 0,
      controller,
    };
    this.running.set(job.scanId, slot);

    const ctx: WatchdogRunContext = {
      signal: controller.signal,
      heartbeat: (phase, percent) => {
        const current = this.running.get(job.scanId);
        if (!current) return;
        current.lastHeartbeatAt = Date.now();
        current.phase = phase;
        current.percent = percent;
      },
    };

    // O job (runInBackground) já se blinda por dentro; este catch é
    // cinto-e-suspensório pra garantir que a vaga SEMPRE seja devolvida —
    // uma exceção escapando aqui deixaria o slot ocupado pra sempre.
    void job
      .run(ctx)
      .catch((error: unknown) => {
        this.raise("error", job.scanId, `Falha não tratada na execução do scan: ${(error as Error).message ?? String(error)}`);
      })
      .finally(() => {
        this.running.delete(job.scanId);
        this.pump();
      });
  }

  // ==========================================================================
  // Monitor de travamento
  // ==========================================================================

  startMonitor(): void {
    if (this.monitor) return;
    this.monitor = setInterval(() => this.tick(), MONITOR_INTERVAL_MS);
    // unref: um interval de vigia não pode, sozinho, impedir o processo (ou o
    // Jest) de encerrar.
    this.monitor.unref?.();
  }

  stopMonitor(): void {
    if (!this.monitor) return;
    clearInterval(this.monitor);
    this.monitor = null;
  }

  /** Exposto pra teste: roda uma varredura de travamento sem esperar o interval. */
  tick(): void {
    const now = Date.now();
    for (const slot of this.running.values()) {
      const silentMs = now - slot.lastHeartbeatAt;
      if (silentMs <= this.heartbeatTimeoutMs) continue;
      const seconds = Math.round(silentMs / 1000);
      this.raise("error", slot.scanId, `Scan sem sinal de vida há ${seconds}s — abortado pelo watchdog.`);
      slot.controller.abort(`Scan abortado pelo watchdog: ficou ${seconds}s sem responder.`);
      // Não removemos o slot aqui: quem devolve a vaga é o `.finally` do job,
      // depois que o runner de fato parar. Remover agora deixaria duas
      // execuções concorrendo pela mesma vaga.
    }
  }

  // ==========================================================================
  // Alertas
  // ==========================================================================

  raise(level: WatchdogAlertLevel, scanId: string | null, message: string): void {
    const alert: WatchdogAlert = { at: new Date().toISOString(), scanId, level, message };
    this.alerts.unshift(alert);
    if (this.alerts.length > MAX_ALERTS) this.alerts.length = MAX_ALERTS;

    const prefix = scanId ? `[DAST watchdog][${scanId}]` : "[DAST watchdog]";
    if (level === "error") console.error(`${prefix} ${message}`);
    else console.warn(`${prefix} ${message}`);
  }

  // ==========================================================================
  // Leitura
  // ==========================================================================

  snapshot(): WatchdogSnapshot {
    return {
      maxConcurrent: this.maxConcurrent,
      runningCount: this.running.size,
      queuedCount: this.queue.length,
      running: [...this.running.values()].map((slot) => ({
        scanId: slot.scanId,
        targetUrl: slot.targetUrl,
        requestedById: slot.requestedById,
        startedAt: new Date(slot.startedAt).toISOString(),
        lastHeartbeatAt: new Date(slot.lastHeartbeatAt).toISOString(),
        phase: slot.phase,
        percent: slot.percent,
      })),
      queued: this.queue.map((job, index) => ({
        scanId: job.scanId,
        targetUrl: job.targetUrl,
        requestedById: job.requestedById,
        queuedAt: new Date(job.queuedAt).toISOString(),
        position: index + 1,
      })),
      alerts: [...this.alerts],
    };
  }

  /** Só pra teste: esvazia fila, execução e alertas sem derrubar o monitor. */
  resetForTests(): void {
    for (const slot of this.running.values()) slot.controller.abort("reset de teste");
    this.running.clear();
    this.queue.length = 0;
    this.alerts.length = 0;
  }
}

function readNumberEnv(key: EnvKeys, fallback: number): number {
  const parsed = Number(EnvVar.getOptional(key, String(fallback)));
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

/**
 * Singleton do processo — a fila só existe em memória, então precisa ser a
 * MESMA instância pra toda a aplicação (mesma razão do singleton do
 * PrismaClient em database/prisma.database.ts). A classe fica exportada à
 * parte pros testes construírem instâncias isoladas com outros limites.
 */
export const dastWatchdog = new DastWatchdog();
