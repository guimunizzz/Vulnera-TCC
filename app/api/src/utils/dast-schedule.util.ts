/**
 * dast-schedule.util.ts
 *
 * Regras puras dos scans DAST agendados (ADR-056 §6): host da autorização,
 * vigência, validação dos campos e o padrão cron gerado NO SERVIDOR. O
 * usuário nunca escreve cron: escolhe frequência, hora, minuto, dia e fuso.
 */

export const FREQUENCIAS = ["DAILY", "WEEKLY"] as const;
export const MODOS = ["REAL", "SIMULATED"] as const;
export type Frequencia = (typeof FREQUENCIAS)[number];
export type Modo = (typeof MODOS)[number];

export const FUSO_PADRAO = "America/Sao_Paulo";

/**
 * Host normalizado de uma URL: minúsculo, sem porta padrão (80/443), com a
 * porta quando não é a padrão. Null se a URL não for http(s) válida. É o que
 * a autorização guarda — mudar o caminho da aplicação não invalida a
 * autorização; mudar o host, sim.
 */
export function normalizarHost(url: string | null | undefined): string | null {
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  // URL já remove a porta padrão do protocolo e põe o hostname em minúsculas.
  return u.host.toLowerCase();
}

export type MotivoAutorizacao = "AUTHORIZATION_MISSING" | "AUTHORIZATION_EXPIRED" | "HOST_MISMATCH" | "APPLICATION_WITHOUT_URL";

/** Confere a autorização de DAST de uma aplicação. Null = vigente e para o host certo. */
export function motivoSemAutorizacao(
  app: { url: string | null; dastAuthorizedAt: Date | null; dastAuthorizedUntil: Date | null; dastAuthorizedHost: string | null },
  agora: Date,
): MotivoAutorizacao | null {
  const host = normalizarHost(app.url);
  if (!host) return "APPLICATION_WITHOUT_URL";
  if (!app.dastAuthorizedAt || !app.dastAuthorizedUntil || !app.dastAuthorizedHost) return "AUTHORIZATION_MISSING";
  if (app.dastAuthorizedUntil.getTime() <= agora.getTime()) return "AUTHORIZATION_EXPIRED";
  if (app.dastAuthorizedHost !== host) return "HOST_MISMATCH";
  return null;
}

/** Fuso IANA válido para o runtime (o mesmo que o cron-parser do BullMQ usa). */
export function fusoValido(tz: unknown): tz is string {
  if (typeof tz !== "string" || tz.length === 0 || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export interface CamposAgendamento {
  frequency: Frequencia;
  hour: number;
  minute: number;
  dayOfWeek: number | null;
  timezone: string;
}

const inteiroEntre = (v: unknown, min: number, max: number): v is number => Number.isInteger(v) && (v as number) >= min && (v as number) <= max;

/** Valida os campos do horário. Devolve o código de erro ou null. */
export function validarCampos(c: Partial<CamposAgendamento>): string | null {
  if (!FREQUENCIAS.includes(c.frequency as Frequencia)) return "INVALID_FREQUENCY";
  if (!inteiroEntre(c.hour, 0, 23)) return "INVALID_HOUR";
  if (!inteiroEntre(c.minute, 0, 59)) return "INVALID_MINUTE";
  if (c.frequency === "WEEKLY" && !inteiroEntre(c.dayOfWeek, 0, 6)) return "INVALID_DAY_OF_WEEK";
  if (c.frequency === "DAILY" && c.dayOfWeek !== null && c.dayOfWeek !== undefined) return "INVALID_DAY_OF_WEEK";
  if (!fusoValido(c.timezone)) return "INVALID_TIMEZONE";
  return null;
}

/** Cron de 5 campos gerado no servidor a partir de campos já validados. */
export function gerarPadraoCron(c: CamposAgendamento): string {
  const dia = c.frequency === "WEEKLY" ? String(c.dayOfWeek) : "*";
  return `${c.minute} ${c.hour} * * ${dia}`;
}

/** Id do job scheduler no Redis. Fixo por agendamento: upsert não duplica. */
export const idSchedulerDast = (scheduleId: string): string => `dast-schedule:${scheduleId}`;
