/**
 * dast-schedule.types.ts — scans DAST agendados (ADR-056), espelho dos DTOs
 * de `dast-schedule.service.ts`. O cron nunca chega aqui: a tela fala em
 * frequência, dia e horário, e o servidor gera o padrão.
 */

export type ModoAgendamento = "REAL" | "SIMULATED";
export type FrequenciaAgendamento = "DAILY" | "WEEKLY";

/** Por que a autorização não vale (null = vigente). */
export type ProblemaAutorizacao = "AUTHORIZATION_MISSING" | "AUTHORIZATION_EXPIRED" | "HOST_MISMATCH" | "APPLICATION_WITHOUT_URL";

export interface AutorizacaoDast {
  applicationId: string;
  authorizedAt: string | null;
  authorizedById: string | null;
  until: string | null;
  host: string | null;
  currentHost: string | null;
  problem: ProblemaAutorizacao | null;
  canEdit: boolean;
}

export interface Agendamento {
  id: string;
  applicationId: string;
  companyId: string;
  projectId: string | null;
  mode: ModoAgendamento;
  frequency: FrequenciaAgendamento;
  hour: number;
  minute: number;
  /** 0 = domingo … 6 = sábado; só em WEEKLY. */
  dayOfWeek: number | null;
  timezone: string;
  enabled: boolean;
  createdById: string;
  lastRunAt: string | null;
  lastScanId: string | null;
  /** STARTED, SCAN_FAILED ou o motivo de não ter rodado (AUTHORIZATION_EXPIRED, TARGET_BUSY…). */
  lastOutcome: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AgendamentoVisivel extends Agendamento {
  application: { id: string; name: string; url: string | null; companyName: string; active: boolean };
  projectName: string | null;
  authorization: { until: string | null; host: string | null; problem: ProblemaAutorizacao | null };
  nextRunAt: string | null;
  canEdit: boolean;
}

export interface PainelAgendamentos {
  /** false = QUEUE_DRIVER=memory: o cadastro funciona, mas nada dispara sozinho. */
  runsSchedules: boolean;
  canCreate: boolean;
  schedules: AgendamentoVisivel[];
}

export interface AlvoDast {
  applicationId: string;
  name: string;
  url: string | null;
  companyName: string;
  authorization: AutorizacaoDast;
  projects: { id: string; name: string }[];
  projectRequired: boolean;
}

/** Campos editáveis de "quando". */
export interface QuandoAgendamento {
  frequency: FrequenciaAgendamento;
  hour: number;
  minute: number;
  dayOfWeek: number | null;
  timezone: string;
}

export interface NovoAgendamentoInput extends QuandoAgendamento {
  mode: ModoAgendamento;
  projectId?: string | null;
  enabled?: boolean;
}

export type EdicaoAgendamentoInput = Partial<QuandoAgendamento> & { enabled?: boolean };
