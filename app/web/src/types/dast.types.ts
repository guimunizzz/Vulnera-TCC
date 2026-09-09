// Tipos espelham os DTOs do backend (app/api/src/models/dast-scan.model.ts e
// dast-finding.model.ts). Módulo DAST: scans automatizados via OWASP ZAP —
// visível só pra PENTESTER/ADMIN (CLIENT não tem acesso, nem item de menu).

export type DastScanStatus = "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
export type DastRisk = "HIGH" | "MEDIUM" | "LOW" | "INFO";

export const DAST_SCAN_STATUS_LABELS: Record<DastScanStatus, string> = {
  QUEUED: "Na fila",
  RUNNING: "Em execução",
  COMPLETED: "Concluído",
  FAILED: "Falhou",
  CANCELLED: "Cancelado",
};

export const DAST_RISK_LABELS: Record<DastRisk, string> = {
  HIGH: "Alto",
  MEDIUM: "Médio",
  LOW: "Baixo",
  INFO: "Informativo",
};

// Ordem de severidade — mesma do backend (RISK_ORDER em dast-finding.model.ts).
export const DAST_RISK_ORDER: Record<DastRisk, number> = { HIGH: 0, MEDIUM: 1, LOW: 2, INFO: 3 };

export interface DastScan {
  id: string;
  targetUrl: string;
  status: DastScanStatus;
  requestedById: string;
  containerName: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  errorMessage: string | null;
  alertsHigh: number;
  alertsMedium: number;
  alertsLow: number;
  alertsInfo: number;
  createdAt: string;
  updatedAt: string;
}

export interface DastFinding {
  id: string;
  scanId: string;
  pluginId: string;
  title: string;
  risk: DastRisk;
  confidence: string;
  cweId: string | null;
  wascId: string | null;
  url: string;
  normalizedUrl: string;
  param: string | null;
  evidence: string | null;
  description: string | null;
  solution: string | null;
  reference: string | null;
  createdAt: string;
}

export interface DastReportData {
  scan: DastScan;
  requestedByName: string | null;
  counters: { high: number; medium: number; low: number; info: number };
  findings: DastFinding[];
  topFindings: DastFinding[];
}

export interface CreateDastScanInput {
  targetUrl: string;
}

// Estados em que o scan ainda está "vivo" — botão Parar habilitado, polling continua.
export const ACTIVE_DAST_STATUSES: DastScanStatus[] = ["QUEUED", "RUNNING"];
export const TERMINAL_DAST_STATUSES: DastScanStatus[] = ["COMPLETED", "FAILED", "CANCELLED"];
