/**
 * threat-intel.ts — formatação compartilhada pelas abas da Threat Intel (ADR-053).
 */

/** Só http(s) vira link: referência de fonte externa pode trazer "javascript:". */
export const linkSeguro = (url: string) => /^https?:\/\//i.test(url);

/** Probabilidade (0..1) como porcentagem; abaixo de 10%, com uma casa. */
export function pct(v: number | null): string {
  return v === null ? "—" : `${(v * 100).toFixed(v < 0.1 ? 1 : 0)}%`;
}

/** "há 12 min", "há 3 h", "em 14/11". */
export function haQuanto(iso: string): string {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 1) return "agora há pouco";
  if (min < 60) return `há ${min} min`;
  if (min < 48 * 60) return `há ${Math.round(min / 60)} h`;
  return `em ${new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`;
}
