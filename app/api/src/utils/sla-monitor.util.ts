/**
 * sla-monitor.util.ts
 *
 * O QUE FAZ
 * Regras puras do monitor de SLA (avisos diários de prazo de remediação):
 * quando uma vulnerabilidade merece aviso, qual aviso, quantas notificações
 * uma pessoa recebe numa execução, o texto e o link de cada uma. Zero I/O e
 * zero Date.now() escondido — o "agora" entra por parâmetro.
 *
 * QUAIS AVISOS
 *   - SLA_DUE_SOON: prazo restante entre 0 e 3 dias (inclusive);
 *   - SLA_OVERDUE:  prazo já passou (`slaDueAt < agora`, a mesma regra do BREACHED
 *                   em sla.util.ts).
 * O prazo lido é o EFETIVO (`slaDueAt`, já empurrado por pausas de aceite).
 *
 * RESUMO
 * Mais de 3 avisos pendentes para a mesma pessoa numa execução viram UMA
 * notificação de resumo (mesmo limite da Threat Intel, D19.6).
 */

import { createHash } from "node:crypto";
import { DIA_MS } from "./sla.util";

/** Janela do aviso "vence em breve", em dias corridos. */
export const JANELA_AVISO_DIAS = 3;

/** Acima deste número de avisos pendentes para uma pessoa, sai um resumo só. */
export const MAX_AVISOS_INDIVIDUAIS_SLA = 3;

/** Categorias gravadas em `Notification.category` (o campo é String livre, sem migration). */
export const CATEGORIA_SLA = {
  VENCE_EM_BREVE: "SLA_DUE_SOON",
  VENCIDA: "SLA_OVERDUE",
  RESUMO: "SLA_RESUMO",
} as const;

export type TipoAvisoSla = "VENCE_EM_BREVE" | "VENCIDA";

/**
 * Em que aviso (se algum) uma vulnerabilidade com este prazo cai neste instante.
 * `null` = prazo ainda longe, nada a avisar.
 */
export function classificarPrazo(slaDueAt: Date, agora: Date): TipoAvisoSla | null {
  const restanteMs = slaDueAt.getTime() - agora.getTime();
  if (restanteMs < 0) return "VENCIDA";
  if (restanteMs <= JANELA_AVISO_DIAS * DIA_MS) return "VENCE_EM_BREVE";
  return null;
}

/** Link para o achado. Rota `/findings/:id` é acessível a ADMIN, PENTESTER e CLIENT. */
export function linkDoAchado(vulnerabilityId: string): string {
  return `/findings/${encodeURIComponent(vulnerabilityId)}`;
}

/**
 * Link do resumo: abre o achado mais urgente (a listagem global é só de ADMIN e PENTESTER,
 * e o CLIENT também recebe resumo). O `lote` identifica o CONJUNTO de avisos: é a chave
 * de deduplicação do resumo, porque o Notification não tem FK para vulnerabilidade.
 */
export function linkDoResumo(vulnerabilityIdMaisUrgente: string, chaveDoLote: string): string {
  return `${linkDoAchado(vulnerabilityIdMaisUrgente)}?lote=${chaveDoLote}`;
}

/**
 * Chave estável de um conjunto de avisos: o mesmo conjunto dá a mesma chave,
 * então rodar o monitor duas vezes não duplica o resumo. Um aviso a mais muda a chave.
 */
export function chaveDoLote(chavesDosAvisos: string[]): string {
  return createHash("sha256").update([...chavesDosAvisos].sort().join("|")).digest("hex").slice(0, 16);
}

function plural(n: number, singular: string, pluralForma: string): string {
  return `${n} ${n === 1 ? singular : pluralForma}`;
}

/** Data curta no fuso do cliente (o cron roda às 08:00 de Brasília). */
export function dataCurta(d: Date): string {
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

/** Dias até o prazo (arredondado para cima, mínimo 1: "vence em 1 dia" enquanto houver horas). */
export function diasAteOPrazo(slaDueAt: Date, agora: Date): number {
  return Math.max(1, Math.ceil((slaDueAt.getTime() - agora.getTime()) / DIA_MS));
}

/** Dias desde o prazo (arredondado para baixo, mínimo 1). */
export function diasDesdeOPrazo(slaDueAt: Date, agora: Date): number {
  return Math.max(1, Math.floor((agora.getTime() - slaDueAt.getTime()) / DIA_MS));
}

/** Título e mensagem de um aviso individual. Título com teto de 191 caracteres (VARCHAR padrão do MySQL). */
export function textoAvisoIndividual(
  tipo: TipoAvisoSla,
  achado: { title: string; severityFinal: string; slaDueAt: Date },
  agora: Date,
): { title: string; message: string } {
  const prazo = dataCurta(achado.slaDueAt);
  if (tipo === "VENCIDA") {
    return {
      title: `Prazo de remediação vencido há ${plural(diasDesdeOPrazo(achado.slaDueAt, agora), "dia", "dias")}`.slice(0, 191),
      message: `${achado.title} (${achado.severityFinal}). O prazo venceu em ${prazo}.`,
    };
  }
  return {
    title: `Prazo de remediação vence em ${plural(diasAteOPrazo(achado.slaDueAt, agora), "dia", "dias")}`.slice(0, 191),
    message: `${achado.title} (${achado.severityFinal}). Prazo: ${prazo}.`,
  };
}

/** Título e mensagem do resumo de uma pessoa numa execução. */
export function textoResumo(vencidas: number, aVencer: number): { title: string; message: string } {
  const total = vencidas + aVencer;
  const partes: string[] = [];
  if (vencidas > 0) partes.push(`${vencidas} com prazo vencido`);
  if (aVencer > 0) partes.push(`${aVencer} vencendo em até ${JANELA_AVISO_DIAS} dias`);
  return {
    title: `${plural(total, "vulnerabilidade pede", "vulnerabilidades pedem")} atenção no prazo de remediação`.slice(0, 191),
    message: `${partes.join(" e ")}.`,
  };
}
