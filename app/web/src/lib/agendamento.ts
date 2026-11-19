/**
 * lib/agendamento.ts — textos da página /agendamentos (ADR-056).
 *
 * Tudo o que a pessoa lê sobre um agendamento passa por aqui, para a lista,
 * o formulário e o tour dizerem a mesma coisa: "Toda segunda às 03:00
 * (horário de Brasília)", nunca "0 3 * * 1".
 */

import type { FrequenciaAgendamento, ProblemaAutorizacao, QuandoAgendamento } from "../types/dast-schedule.types";

/** 0 = domingo, como na API. A ordem da tela começa na segunda (semana de trabalho). */
export const DIAS_SEMANA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"] as const;
export const DIAS_CURTOS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;
export const ORDEM_DIAS_TELA = [1, 2, 3, 4, 5, 6, 0] as const;

/** Fusos oferecidos. O servidor aceita qualquer IANA; a tela mostra os do Brasil e UTC. */
export const FUSOS: { valor: string; rotulo: string }[] = [
  { valor: "America/Sao_Paulo", rotulo: "Horário de Brasília" },
  { valor: "America/Manaus", rotulo: "Horário do Amazonas" },
  { valor: "America/Rio_Branco", rotulo: "Horário do Acre" },
  { valor: "America/Noronha", rotulo: "Horário de Fernando de Noronha" },
  { valor: "UTC", rotulo: "UTC" },
];
export const FUSO_PADRAO = "America/Sao_Paulo";

/** Horários sugeridos: fora do expediente, quando um scan incomoda menos. */
export const HORARIOS_SUGERIDOS: { hora: number; minuto: number; rotulo: string }[] = [
  { hora: 3, minuto: 0, rotulo: "Madrugada" },
  { hora: 12, minuto: 30, rotulo: "Almoço" },
  { hora: 22, minuto: 0, rotulo: "Noite" },
];

export const horario = (hora: number, minuto: number): string => `${String(hora).padStart(2, "0")}:${String(minuto).padStart(2, "0")}`;

export function rotuloFuso(tz: string): string {
  if (tz === "UTC") return "UTC";
  const rotulo = FUSOS.find((f) => f.valor === tz)?.rotulo;
  // Entra no meio da frase: "(horário de Brasília)", "(horário do Amazonas)".
  return rotulo ? rotulo.charAt(0).toLowerCase() + rotulo.slice(1) : tz;
}

/** "Todo dia às 03:00" / "Toda segunda às 22:00" — sem o fuso. */
export function descreverQuando(q: Pick<QuandoAgendamento, "frequency" | "hour" | "minute" | "dayOfWeek">): string {
  const hora = horario(q.hour, q.minute);
  if (q.frequency === "WEEKLY" && q.dayOfWeek !== null && q.dayOfWeek >= 0 && q.dayOfWeek <= 6) {
    const dia = DIAS_SEMANA[q.dayOfWeek];
    // "Todo sábado/domingo" (masculino), "Toda segunda…sexta" (feminino).
    const artigo = q.dayOfWeek === 0 || q.dayOfWeek === 6 ? "Todo" : "Toda";
    return `${artigo} ${dia} às ${hora}`;
  }
  return `Todo dia às ${hora}`;
}

/** Frase completa, com o fuso: a que aparece na prévia do formulário. */
export function descreverQuandoCompleto(q: QuandoAgendamento): string {
  return `${descreverQuando(q)} (${rotuloFuso(q.timezone)})`;
}

export const ROTULO_FREQUENCIA: Record<FrequenciaAgendamento, string> = { DAILY: "Todo dia", WEEKLY: "Toda semana" };

/** O que aconteceu na última vez — `lastOutcome` da API em português. */
const DESFECHOS: Record<string, { texto: string; tom: "sucesso" | "atencao" | "perigo" | "neutro" }> = {
  STARTED: { texto: "Scan iniciado", tom: "sucesso" },
  SCAN_FAILED: { texto: "O scan falhou", tom: "perigo" },
  DISABLED: { texto: "Não rodou: estava pausado", tom: "neutro" },
  APPLICATION_INACTIVE: { texto: "Não rodou: aplicação desativada", tom: "atencao" },
  COMPANY_MISMATCH: { texto: "Não rodou: a aplicação mudou de empresa", tom: "perigo" },
  AUTHORIZATION_MISSING: { texto: "Não rodou: sem autorização do alvo", tom: "atencao" },
  AUTHORIZATION_EXPIRED: { texto: "Não rodou: a autorização venceu", tom: "atencao" },
  HOST_MISMATCH: { texto: "Não rodou: o endereço da aplicação mudou", tom: "atencao" },
  APPLICATION_WITHOUT_URL: { texto: "Não rodou: a aplicação está sem URL", tom: "atencao" },
  CREATOR_INACTIVE: { texto: "Não rodou: quem agendou não tem mais acesso", tom: "atencao" },
  NOT_MEMBER: { texto: "Não rodou: quem agendou saiu do projeto", tom: "atencao" },
  TARGET_BUSY: { texto: "Não rodou: já havia um scan nesse alvo", tom: "neutro" },
  QUEUE_UNAVAILABLE: { texto: "Não rodou: a fila estava fora do ar", tom: "perigo" },
  ERROR: { texto: "Não rodou: erro inesperado", tom: "perigo" },
};

export function descreverDesfecho(codigo: string | null): { texto: string; tom: "sucesso" | "atencao" | "perigo" | "neutro" } | null {
  if (!codigo) return null;
  return DESFECHOS[codigo] ?? { texto: `Não rodou (${codigo})`, tom: "atencao" };
}

/** Situação da autorização do alvo, do jeito que a pessoa precisa ler. */
export function descreverProblemaAutorizacao(p: ProblemaAutorizacao): string {
  switch (p) {
    case "AUTHORIZATION_MISSING":
      return "Este alvo ainda não tem autorização de teste registrada.";
    case "AUTHORIZATION_EXPIRED":
      return "A autorização de teste deste alvo venceu.";
    case "HOST_MISMATCH":
      return "O endereço da aplicação mudou depois da autorização. Autorize de novo para o endereço atual.";
    case "APPLICATION_WITHOUT_URL":
      return "A aplicação não tem URL cadastrada, então não há o que escanear.";
  }
}

export const ROTULO_PROBLEMA_CURTO: Record<ProblemaAutorizacao, string> = {
  AUTHORIZATION_MISSING: "Sem autorização",
  AUTHORIZATION_EXPIRED: "Autorização vencida",
  HOST_MISMATCH: "Endereço mudou",
  APPLICATION_WITHOUT_URL: "Sem URL",
};

export function dataCurta(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function dataHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

/** "em 3 h", "em 2 dias", "em 5 min" — para o próximo disparo. */
export function emQuantoTempo(iso: string, agora: Date = new Date()): string {
  const min = Math.round((new Date(iso).getTime() - agora.getTime()) / 60_000);
  if (min <= 0) return "agora";
  if (min < 60) return `em ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `em ${h} h`;
  const d = Math.round(h / 24);
  return `em ${d} ${d === 1 ? "dia" : "dias"}`;
}

/** Valor do `<input type="date">` daqui a N dias (prazo padrão da autorização). */
export function dataDaquiA(dias: number, agora: Date = new Date()): string {
  const d = new Date(agora.getTime() + dias * 24 * 3600_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Fim do dia escolhido, no fuso do navegador, em ISO — a autorização vale o dia inteiro. */
export function fimDoDia(dataYmd: string): string {
  const [a, m, d] = dataYmd.split("-").map(Number);
  return new Date(a!, m! - 1, d!, 23, 59, 0).toISOString();
}
