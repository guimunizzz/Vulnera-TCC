/**
 * cvss.util.ts
 *
 * Parser MANUAL do vetor CVSS v3.1 (RN10) — implementa as fórmulas oficiais
 * publicadas pelo FIRST (https://www.first.org/cvss/v3.1/specification-document,
 * seção 7 "CVSS v3.1 Equations") sem depender de nenhuma lib externa. A banca
 * do TCC pode perguntar como o cálculo funciona por dentro, então cada etapa
 * abaixo é comentada com a fórmula correspondente.
 *
 * Vetor esperado (prefixo de versão "CVSS:3.1/" é opcional):
 *   AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H
 *
 * Vetor mal formado (métrica faltando, valor fora do domínio, métrica
 * duplicada ou desconhecida) lança Error("INVALID_CVSS_VECTOR") — quem
 * chama (VulnerabilityService) deixa o erro subir pro controller traduzir
 * em 400.
 */

export type CvssSeverity = "NONE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface CvssResult {
  score: number;
  severity: CvssSeverity;
}

// === Pesos oficiais de cada métrica base (tabelas 3-1 a 3-8 da spec) ========
const AV_WEIGHTS: Record<string, number> = { N: 0.85, A: 0.62, L: 0.55, P: 0.2 };
const AC_WEIGHTS: Record<string, number> = { L: 0.77, H: 0.44 };
// PR (Privileges Required) tem 2 tabelas — o peso muda conforme o Scope,
// porque "privilégio necessário" pesa diferente quando o exploit escapa
// do componente vulnerável (Scope Changed) pra outro.
const PR_WEIGHTS_SCOPE_UNCHANGED: Record<string, number> = { N: 0.85, L: 0.62, H: 0.27 };
const PR_WEIGHTS_SCOPE_CHANGED: Record<string, number> = { N: 0.85, L: 0.68, H: 0.5 };
const UI_WEIGHTS: Record<string, number> = { N: 0.85, R: 0.62 };
// C, I, A (Confidentiality/Integrity/Availability) usam a mesma tabela
const CIA_WEIGHTS: Record<string, number> = { N: 0, L: 0.22, H: 0.56 };
const SCOPE_VALUES = ["U", "C"];

const REQUIRED_METRICS = ["AV", "AC", "PR", "UI", "S", "C", "I", "A"] as const;
type MetricKey = (typeof REQUIRED_METRICS)[number];

/**
 * Roundup conforme o Apêndice A da spec do FIRST — arredonda pra 1 casa
 * decimal SEMPRE pra cima. Não dá pra usar Math.round comum porque o
 * ponto flutuante do JS erra em casos de borda (ex: 4.0 vira 3.9999999996).
 * O algoritmo trabalha em inteiros (score × 100000) pra evitar esse erro.
 */
function roundUp(input: number): number {
  const intInput = Math.round(input * 100000);
  if (intInput % 10000 === 0) {
    return intInput / 100000;
  }
  return (Math.floor(intInput / 10000) + 1) / 10;
}

/** Extrai as 8 métricas base do vetor, validando presença e ausência de duplicidade. */
function parseVector(vector: string): Record<MetricKey, string> {
  if (!vector || typeof vector !== "string") throw new Error("INVALID_CVSS_VECTOR");

  const withoutPrefix = vector.startsWith("CVSS:3.1/") ? vector.slice("CVSS:3.1/".length) : vector;
  const segments = withoutPrefix.split("/").filter(Boolean);
  const parsed: Partial<Record<MetricKey, string>> = {};

  for (const segment of segments) {
    const parts = segment.split(":");
    if (parts.length !== 2) throw new Error("INVALID_CVSS_VECTOR");

    const [key, value] = parts;
    if (!REQUIRED_METRICS.includes(key as MetricKey)) throw new Error("INVALID_CVSS_VECTOR");
    if (parsed[key as MetricKey]) throw new Error("INVALID_CVSS_VECTOR"); // métrica repetida
    parsed[key as MetricKey] = value;
  }

  for (const metric of REQUIRED_METRICS) {
    if (!parsed[metric]) throw new Error("INVALID_CVSS_VECTOR");
  }

  return parsed as Record<MetricKey, string>;
}

/** Faixas oficiais do FIRST — ver docs/Vulnera/02-Dominio/Conceitos/CVSS.md */
function severityFromScore(score: number): CvssSeverity {
  if (score === 0) return "NONE";
  if (score <= 3.9) return "LOW";
  if (score <= 6.9) return "MEDIUM";
  if (score <= 8.9) return "HIGH";
  return "CRITICAL";
}

export function calculateCvss(vector: string): CvssResult {
  const metrics = parseVector(vector);

  if (!SCOPE_VALUES.includes(metrics.S)) throw new Error("INVALID_CVSS_VECTOR");
  const scopeChanged = metrics.S === "C";

  const av = AV_WEIGHTS[metrics.AV];
  const ac = AC_WEIGHTS[metrics.AC];
  const pr = (scopeChanged ? PR_WEIGHTS_SCOPE_CHANGED : PR_WEIGHTS_SCOPE_UNCHANGED)[metrics.PR];
  const ui = UI_WEIGHTS[metrics.UI];
  const c = CIA_WEIGHTS[metrics.C];
  const i = CIA_WEIGHTS[metrics.I];
  const a = CIA_WEIGHTS[metrics.A];

  if ([av, ac, pr, ui, c, i, a].some((weight) => weight === undefined)) {
    throw new Error("INVALID_CVSS_VECTOR");
  }

  // ISCBase (Impact Sub-Score Base) — "o quanto a exploração compromete
  // Confidencialidade/Integridade/Disponibilidade", combinadas como
  // probabilidade complementar (1 menos a chance de nada ser comprometido)
  const iscBase = 1 - (1 - c) * (1 - i) * (1 - a);

  // Impact — muda de fórmula conforme o Scope. Scope Changed usa uma curva
  // que "achata" o ganho pra impactos muito altos (exploit que escapa do
  // componente original não escala tão linearmente).
  const impact = scopeChanged
    ? 7.52 * (iscBase - 0.029) - 3.25 * (iscBase - 0.02) ** 15
    : 6.42 * iscBase;

  // Exploitability — "o quão fácil é explorar", independe do impacto
  const exploitability = 8.22 * av * ac * pr * ui;

  // Impact <= 0 (ex: C=I=A=None) → não há score de risco, é 0/None
  if (impact <= 0) {
    return { score: 0, severity: "NONE" };
  }

  const rawScore = scopeChanged ? 1.08 * (impact + exploitability) : impact + exploitability;
  const score = roundUp(Math.min(rawScore, 10));

  return { score, severity: severityFromScore(score) };
}
