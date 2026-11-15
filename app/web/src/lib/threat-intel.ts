/**
 * threat-intel.ts — formatação compartilhada pelas abas da Threat Intel (ADR-053).
 */

/** Só http(s) vira link: referência de fonte externa pode trazer "javascript:". */
export const linkSeguro = (url: string) => /^https?:\/\//i.test(url);

/** Probabilidade (0..1) como porcentagem; abaixo de 10%, com uma casa. */
export function pct(v: number | null): string {
  return v === null ? "—" : `${(v * 100).toFixed(v < 0.1 ? 1 : 0)}%`;
}
