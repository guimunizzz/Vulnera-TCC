/**
 * sla-text.ts
 *
 * O QUE FAZ
 * Transforma o estado do SLA e os milissegundos restantes em frase humana:
 * "vence em 2 dias", "vencido há 4 dias", "resolvido no prazo". Funções
 * PURAS, zero React — mesmo motivo de `finding-query.ts`: o pedaço mais fácil
 * de errar (arredondamento, singular/plural, sinal) vira uma linha de teste
 * cada, em vez de um clique na tela.
 *
 * O ESTADO VEM DO BACKEND. Aqui não se decide "venceu?"; só se escreve.
 *
 * QUEM USA
 * `components/findings/sla-badge.tsx`. O mobile tem uma cópia com o mesmo
 * vocabulário em `app/mobile/src/types/vulnerability.types.ts`.
 */

import { SLA_STATE_LABELS, type SlaState } from "../types/vulnerability.types";

const DIA_MS = 86_400_000;
const HORA_MS = 3_600_000;

/** "2 dias" / "1 dia" / "5 horas" / "menos de 1 hora" — sempre positivo; o sinal é do chamador. */
export function duracaoHumana(ms: number): string {
  const abs = Math.abs(ms);
  if (abs < HORA_MS) return "menos de 1 hora";
  if (abs < DIA_MS) {
    const h = Math.round(abs / HORA_MS);
    return `${h} hora${h === 1 ? "" : "s"}`;
  }
  const d = Math.round(abs / DIA_MS);
  return `${d} dia${d === 1 ? "" : "s"}`;
}

/** A frase do chip, dado estado e restante. */
export function fraseDoSla(state: SlaState, remainingMs: number | null): string {
  switch (state) {
    case "ON_TRACK":
    case "DUE_SOON":
      return remainingMs == null ? SLA_STATE_LABELS[state] : `vence em ${duracaoHumana(remainingMs)}`;
    case "BREACHED":
      return remainingMs == null ? SLA_STATE_LABELS[state] : `vencido há ${duracaoHumana(remainingMs)}`;
    default:
      return SLA_STATE_LABELS[state].toLowerCase();
  }
}
