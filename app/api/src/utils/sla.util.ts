/**
 * sla.util.ts
 *
 * O QUE FAZ
 * Toda a aritmética do SLA de remediação (CP-2) em funções PURAS: quantos
 * dias uma severidade tem, quando vence, quando entra em "vence em breve",
 * e em que estado um finding está agora. Zero I/O, zero Prisma, zero
 * Date.now() escondido — o "agora" entra por parâmetro, o que é o que permite
 * testar "vence em 2 dias" sem esperar dois dias.
 *
 * 🎯 PERSISTE-SE O PRAZO, DERIVA-SE O ESTADO
 * Duas datas são gravadas na Vulnerability e NUNCA o estado:
 *
 *   slaDueAt      — o prazo EFETIVO: quando estoura. Quando uma pausa (Risk
 *                   Acceptance, CP-4) termina, o service EMPURRA esta data
 *                   pelo intervalo pausado, e soma o mesmo intervalo em
 *                   slaPausedMs. Assim `slaDueAt < agora` é sempre "estourou",
 *                   e slaPausedMs explica quanto do prazo veio de pausa.
 *   slaDueSoonAt  — o instante em que restam 20% da janela ORIGINAL. Também
 *                   empurrado junto com o prazo.
 *
 * POR QUE DUAS DATAS E NÃO UMA CONTA
 * O filtro `slaState=DUE_SOON` da busca global precisa existir nos DOIS
 * construtores de WHERE do repository — o do Prisma e o SQL cru — e eles
 * têm de concordar (canário VULN-LIST-07b). O Prisma só compara coluna com
 * constante: não expressa `dueAt - 0.2*(dueAt - startedAt) <= agora`. Com a
 * data já calculada, todo estado ativo vira `coluna <op> agora`, que os dois
 * sabem escrever. É a mesma filosofia de `slaDueAt`: calcular uma vez, na
 * escrita, o que a leitura vai perguntar mil vezes.
 *
 * UTC E DIAS CORRIDOS
 * Tudo em milissegundos de época. "N dias" é N × 86.400.000 ms — sem
 * calendário, sem feriado, sem fuso (ADR-025 já agrega em UTC).
 *
 * QUEM USA
 * `services/vulnerability.service.ts`, `services/sla-policy.service.ts`,
 * `services/dast-triage.service.ts`, `prisma/backfill-sla.ts` e os DTOs.
 */

export const DIA_MS = 86_400_000;

/**
 * Fração da janela ORIGINAL abaixo da qual o finding entra em DUE_SOON.
 * Percentual e não "N dias fixos": 2 dias para um CRITICAL de 2 dias seria
 * avisar antes de o relógio começar; 7 dias para um LOW de 90 avisaria tarde
 * demais. 20% escala com a janela — 0,4 dia num crítico, 18 dias num baixo.
 */
export const DUE_SOON_FRACTION = 0.2;

export const SLA_STATES = [
  "NO_SLA",
  "ON_TRACK",
  "DUE_SOON",
  "BREACHED",
  "ACCEPTED",
  "RESOLVED_IN_SLA",
  "RESOLVED_LATE",
] as const;
export type SlaState = (typeof SLA_STATES)[number];

/**
 * O que a BUSCA aceita em `?slaState=`. É um subconjunto: RESOLVED_IN_SLA e
 * RESOLVED_LATE só se distinguem com o AuditLog (data da transição → FIXED),
 * que os construtores de WHERE não alcançam sem JOIN em subconsulta agregada
 * — então a busca oferece RESOLVED (os dois juntos) e o DTO mostra o split.
 * ACCEPTED entra no CP-4, quando existir RiskAcceptance para consultar.
 */
export const SLA_FILTER_VALUES = ["NO_SLA", "ON_TRACK", "DUE_SOON", "BREACHED", "RESOLVED"] as const;
export type SlaFilterValue = (typeof SLA_FILTER_VALUES)[number];

/** Status em que o relógio está CORRENDO. */
export const SLA_ACTIVE_STATUSES = ["OPEN", "IN_PROGRESS"] as const;
/** Status em que o relógio PAROU. */
export const SLA_RESOLVED_STATUSES = ["FIXED", "CLOSED"] as const;

/** Os quatro prazos de uma política — o mínimo que `slaDaysFor` precisa. */
export interface SlaWindow {
  criticalDays: number;
  highDays: number;
  mediumDays: number;
  lowDays: number;
}

/**
 * Quantos dias corridos a severidade tem sob esta política.
 * `NONE` (informativo) não tem SLA — devolve null, e o finding fica NO_SLA.
 * Severidade desconhecida também: chutar um prazo seria inventar conformidade.
 */
export function slaDaysFor(policy: SlaWindow, severityFinal: string): number | null {
  switch (severityFinal) {
    case "CRITICAL":
      return policy.criticalDays;
    case "HIGH":
      return policy.highDays;
    case "MEDIUM":
      return policy.mediumDays;
    case "LOW":
      return policy.lowDays;
    default:
      return null;
  }
}

/** Prazo = início + N dias corridos, em UTC puro. */
export function computeSlaDueAt(startedAt: Date, days: number): Date {
  return new Date(startedAt.getTime() + days * DIA_MS);
}

/** O instante em que restam 20% da janela: início + 80% de N dias. */
export function computeSlaDueSoonAt(startedAt: Date, days: number): Date {
  return new Date(startedAt.getTime() + days * DIA_MS * (1 - DUE_SOON_FRACTION));
}

/**
 * As três datas de um ciclo, de uma vez — é o que todo caminho que grava SLA
 * chama, para nunca gravar dueAt sem dueSoonAt (ou vice-versa).
 * `null` quando a severidade não tem prazo.
 */
export function computeSlaCycle(
  startedAt: Date,
  policy: SlaWindow,
  severityFinal: string,
): { slaStartedAt: Date; slaDueAt: Date; slaDueSoonAt: Date } | null {
  const days = slaDaysFor(policy, severityFinal);
  if (days === null) return null;
  return {
    slaStartedAt: startedAt,
    slaDueAt: computeSlaDueAt(startedAt, days),
    slaDueSoonAt: computeSlaDueSoonAt(startedAt, days),
  };
}

export interface SlaInput {
  /** Status canônico da Vulnerability (OPEN | IN_PROGRESS | FIXED | CLOSED). */
  status: string;
  /** Prazo EFETIVO (já empurrado por pausas). */
  slaDueAt: Date | null;
  /** Instante dos 20% restantes (já empurrado por pausas). null = não avisar. */
  slaDueSoonAt?: Date | null;
  /**
   * Quando o finding foi resolvido (primeiro STATUS_CHANGE → FIXED, reconstruído
   * do AuditLog pelo service). Só importa quando status é FIXED/CLOSED.
   */
  resolvedAt?: Date | null;
  /** Existe Risk Acceptance APROVADO e vigente (CP-4)? Pausa o relógio. */
  acceptedActive?: boolean;
  /** O "agora" — por parâmetro, para o cálculo ser reproduzível em teste. */
  now: Date;
}

/**
 * O estado do SLA neste instante.
 *
 * Ordem das regras — a primeira que casa vence:
 *   1. sem prazo                     → NO_SLA
 *   2. status FIXED/CLOSED           → RESOLVED_IN_SLA | RESOLVED_LATE
 *   3. aceite vigente                → ACCEPTED
 *   4. agora > prazo                 → BREACHED
 *   5. agora ≥ instante dos 20%      → DUE_SOON
 *   6. senão                         → ON_TRACK
 *
 * "Resolvido" é avaliado ANTES de "aceito": um finding corrigido com um aceite
 * ainda vigente está corrigido — o aceite era pra quando ele estava aberto.
 *
 * ⚠️ RESOLVED sem `resolvedAt`: é um finding FIXED/CLOSED cuja transição não
 * está no AuditLog (anterior à trilha, ou gravado direto no banco). Sem a
 * data não dá para julgar; a saída é comparar o prazo com AGORA — se o prazo
 * ainda não passou, ele necessariamente foi resolvido dentro dele. Se já
 * passou, não temos como saber, e o util devolve RESOLVED_LATE de propósito:
 * inventar conformidade é pior que reportar atraso que pode não ter havido.
 * O service evita esse caminho passando `updatedAt` como último recurso.
 *
 * ⚠️ As regras 4 e 5 são EXATAMENTE as que o repository escreve em SQL e em
 * Prisma para o filtro `?slaState=`. Se mudar aqui, mudam lá — e o canário
 * SLA-07 compara os dois.
 */
export function slaState(input: SlaInput): SlaState {
  if (!input.slaDueAt) return "NO_SLA";

  const prazo = input.slaDueAt.getTime();
  const agora = input.now.getTime();

  if (input.status === "FIXED" || input.status === "CLOSED") {
    const resolvidoEm = (input.resolvedAt ?? input.now).getTime();
    return resolvidoEm <= prazo ? "RESOLVED_IN_SLA" : "RESOLVED_LATE";
  }

  if (input.acceptedActive) return "ACCEPTED";

  if (agora > prazo) return "BREACHED";
  if (input.slaDueSoonAt && agora >= input.slaDueSoonAt.getTime()) return "DUE_SOON";
  return "ON_TRACK";
}

/**
 * Milissegundos até o prazo (negativo = já venceu). null sem SLA.
 * É o número que a UI transforma em "vence em 2 dias" / "vencido há 4 dias".
 */
export function slaRemainingMs(input: Pick<SlaInput, "slaDueAt" | "now">): number | null {
  if (!input.slaDueAt) return null;
  return input.slaDueAt.getTime() - input.now.getTime();
}

/** Dias inteiros (arredondados para o inteiro mais próximo) — para texto humano. */
export function msToDays(ms: number): number {
  return Math.round(ms / DIA_MS);
}

/**
 * Empurra as duas datas por um intervalo — o que o service faz quando uma
 * pausa (Risk Acceptance) termina. Devolve as novas datas; quem chama grava
 * e soma `intervalMs` em slaPausedMs.
 */
export function shiftSlaCycle(
  cycle: { slaDueAt: Date; slaDueSoonAt: Date | null },
  intervalMs: number,
): { slaDueAt: Date; slaDueSoonAt: Date | null } {
  const delta = Math.max(0, intervalMs);
  return {
    slaDueAt: new Date(cycle.slaDueAt.getTime() + delta),
    slaDueSoonAt: cycle.slaDueSoonAt ? new Date(cycle.slaDueSoonAt.getTime() + delta) : null,
  };
}
