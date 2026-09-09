/**
 * dast-scan.model.ts
 *
 * Uma execução de scan DAST (OWASP ZAP) contra uma targetUrl. Ver
 * services/zap-runner.service.ts (execução) e services/dast-scan.service.ts
 * (orquestração: cria QUEUED, dispara em background, atualiza status).
 *
 * `htmlReportPath`/`jsonReportPath` são caminhos absolutos no disco do
 * servidor — NUNCA vão pro DTO de resposta (vazaria estrutura de arquivos do
 * host). O relatório é sempre servido pelos endpoints dedicados
 * (`/report/html`, `/report/data`), que resolvem o caminho a partir do
 * registro no banco, nunca de input do cliente.
 *
 * `progress`/`phase`/`simulated`/`warningMessage` (2026-09-09) VÃO pro DTO de
 * propósito: são exatamente o que a UI precisa pra desenhar a barra de
 * progresso e pra deixar visível quando um resultado é simulado — o buraco de
 * produto descrito em docs/DAST-DOCKER-GAP.md §5.
 */

import type { DastScan as PrismaDastScan, DastScanStatus } from "@prisma/client";

export type DastScan = PrismaDastScan;
export type { DastScanStatus };

export type CreateDastScanDTO = {
  targetUrl: string;
};

export type DastScanResponseDTO = {
  id: string;
  targetUrl: string;
  status: DastScanStatus;
  requestedById: string;
  containerName: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  errorMessage: string | null;
  progress: number;
  phase: string | null;
  simulated: boolean;
  warningMessage: string | null;
  alertsHigh: number;
  alertsMedium: number;
  alertsLow: number;
  alertsInfo: number;
  createdAt: string;
  updatedAt: string;
};

export class DastScanEntity {
  constructor(private readonly data: DastScan) {}

  get id(): string {
    return this.data.id;
  }

  get status(): DastScanStatus {
    return this.data.status;
  }

  get requestedById(): string {
    return this.data.requestedById;
  }

  get targetUrl(): string {
    return this.data.targetUrl;
  }

  /** QUEUED ou RUNNING — únicos estados em que cancelar/matar container faz sentido. */
  isActive(): boolean {
    return this.data.status === "QUEUED" || this.data.status === "RUNNING";
  }

  toResponse(): DastScanResponseDTO {
    return {
      id: this.data.id,
      targetUrl: this.data.targetUrl,
      status: this.data.status,
      requestedById: this.data.requestedById,
      containerName: this.data.containerName,
      startedAt: this.data.startedAt ? this.data.startedAt.toISOString() : null,
      finishedAt: this.data.finishedAt ? this.data.finishedAt.toISOString() : null,
      durationMs: this.data.durationMs,
      errorMessage: this.data.errorMessage,
      progress: this.data.progress,
      phase: this.data.phase,
      simulated: this.data.simulated,
      warningMessage: this.data.warningMessage,
      alertsHigh: this.data.alertsHigh,
      alertsMedium: this.data.alertsMedium,
      alertsLow: this.data.alertsLow,
      alertsInfo: this.data.alertsInfo,
      createdAt: this.data.createdAt.toISOString(),
      updatedAt: this.data.updatedAt.toISOString(),
    };
  }
}
