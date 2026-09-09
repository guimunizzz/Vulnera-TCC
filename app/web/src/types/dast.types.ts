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

/**
 * Fases de execução reportadas pelo runner (SCAN_PHASE_LABELS em
 * zap-runner.service.ts). `phase` chega como string livre justamente pra o
 * front não quebrar se o backend ganhar uma fase nova — o fallback abaixo
 * cobre qualquer valor desconhecido.
 */
export const DAST_PHASE_LABELS: Record<string, string> = {
  QUEUED: "Na fila, aguardando uma vaga",
  STARTING: "Subindo o OWASP ZAP",
  SPIDER: "Rastreando o alvo (spider)",
  PASSIVE: "Analisando respostas (scan passivo)",
  ACTIVE: "Testando vulnerabilidades (scan ativo)",
  REPORT: "Gerando relatórios",
  DONE: "Concluído",
  SIMULATED: "Resultado simulado",
  FAILED: "Falhou",
  CANCELLED: "Cancelado",
};

export function labelDaFase(phase: string | null): string {
  if (!phase) return "Preparando";
  return DAST_PHASE_LABELS[phase] ?? phase;
}

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
  /** 0..100 consolidado das fases do scan. */
  progress: number;
  /** Fase corrente (ver DAST_PHASE_LABELS). */
  phase: string | null;
  /** true = achados vieram do gerador de demonstração, não do ZAP. */
  simulated: boolean;
  /** Aviso amigável de um scan que concluiu COM ressalva (tipicamente simulado). */
  warningMessage: string | null;
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

/* ==========================================================================
   Status do módulo (GET /dast/scans/status)

   Espelha DastModuleStatus em dast-scan.service.ts. É o que alimenta o
   banner da tela de DAST: Docker disponível?, quantos scans rodando, quantos
   na fila e os avisos recentes do watchdog.
   ========================================================================== */

export interface DastWatchdogRunning {
  scanId: string;
  targetUrl: string;
  requestedById: string;
  startedAt: string;
  lastHeartbeatAt: string;
  phase: string | null;
  percent: number;
}

export interface DastWatchdogQueued {
  scanId: string;
  targetUrl: string;
  requestedById: string;
  queuedAt: string;
  /** 1 = próximo a entrar. */
  position: number;
}

export interface DastWatchdogAlert {
  at: string;
  scanId: string | null;
  level: "warn" | "error";
  message: string;
}

export interface DastModuleStatus {
  dockerAvailable: boolean;
  dockerCheckedAt: string;
  maxConcurrent: number;
  runningCount: number;
  queuedCount: number;
  running: DastWatchdogRunning[];
  queued: DastWatchdogQueued[];
  alerts: DastWatchdogAlert[];
}

// Estados em que o scan ainda está "vivo" — botão Parar habilitado, polling continua.
export const ACTIVE_DAST_STATUSES: DastScanStatus[] = ["QUEUED", "RUNNING"];
export const TERMINAL_DAST_STATUSES: DastScanStatus[] = ["COMPLETED", "FAILED", "CANCELLED"];
