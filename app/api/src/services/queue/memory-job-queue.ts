/**
 * memory-job-queue.ts
 *
 * Motor `memory` (ADR-056): não guarda nada novo. A fila DAST continua no
 * watchdog (`dast-watchdog.service.ts`) e a Threat Intel no próprio processo
 * (`agendador.ts` + disparo em segundo plano), exatamente como antes do
 * ADR-056 — é o caminho de rollback e o padrão até a Fase 4 ser aprovada.
 */

import type { JobQueue, PedidoScanDast, ScanNaFila, ThreatIntelJobData } from "./job-queue";
import type { ThreatIntelSyncService } from "../threat-intel/threat-intel-sync.service";
import type { DastWatchdog } from "../dast-watchdog.service";

/**
 * Quem executa cada assunto no próprio processo. São getters (resolvidos na
 * primeira chamada) porque as factories da fila e da Threat Intel se
 * referenciam: resolver na construção criaria um ciclo de inicialização.
 */
export interface ExecutoresEmMemoria {
  threatIntel: () => Pick<ThreatIntelSyncService, "executar" | "emAndamento">;
  watchdogDast: () => Pick<DastWatchdog, "submit" | "snapshot">;
}

export class MemoryJobQueue implements JobQueue {
  readonly driver = "memory" as const;

  constructor(private readonly executores: ExecutoresEmMemoria) {}

  async verificarConexao(): Promise<void> {
    // Nada externo para alcançar: a fila vive no próprio processo.
  }

  async enfileirarThreatIntel(dados: ThreatIntelJobData): Promise<void> {
    // Mesmo comportamento de antes do ADR-056: dispara e não espera (o NVD
    // leva até 6,5 s por produto sem chave). Pedido durante outra execução:
    // MANUAL é descartado, ASSET entra nos pendentes do próprio sync.
    const sync = this.executores.threatIntel();
    const rotulo = dados.trigger === "ASSET" ? "backfill do inventário" : "sincronização manual";
    sync.executar(dados.trigger, dados.assetIds).catch((e) => console.error(`Threat Intel: ${rotulo} falhou`, e));
  }

  async threatIntelEmAndamento(): Promise<boolean> {
    return this.executores.threatIntel().emAndamento();
  }

  async enfileirarDastScan(pedido: PedidoScanDast): Promise<number> {
    // Exatamente o caminho de antes do ADR-056: o watchdog decide quando começa.
    return this.executores.watchdogDast().submit(pedido);
  }

  async removerDastScanDaFila(): Promise<boolean> {
    // O cancelamento já chamou watchdog.abort, que tira o scan da fila em memória.
    return false;
  }

  async dastNaFila(): Promise<ScanNaFila[]> {
    return this.executores
      .watchdogDast()
      .snapshot()
      .queued.map((q) => ({ scanId: q.scanId, queuedAt: q.queuedAt }));
  }

  async proximasExecucoesDast(): Promise<null> {
    return null;
  }

  async aplicarAgendamentosDast(): Promise<null> {
    // Sem Redis não há relógio para os agendamentos: honesto em vez de fingir.
    return null;
  }

  async close(): Promise<void> {
    // Sem conexões abertas.
  }
}
