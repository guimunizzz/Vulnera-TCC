/**
 * cvss.ts
 *
 * Espelho EM TYPESCRIPT do parser CVSS 3.1 do backend
 * (app/api/src/utils/cvss.util.ts) — usado pro FindingEditor calcular
 * score/severidade EM TEMPO REAL enquanto o usuário digita o vetor, sem
 * round-trip ao servidor a cada tecla. O backend continua sendo a fonte da
 * verdade (recalcula tudo de novo no create/update) — este arquivo é só
 * preview client-side, então mantenha as duas cópias em sincronia manual se
 * a fórmula mudar (não há pacote de tipos/lógica compartilhado entre
 * api/web nesta fase do projeto).
 *
 * Fórmulas oficiais do FIRST (CVSS v3.1 specification, seção 7).
 */

export type CvssSeverity = "NONE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface CvssResult {
  score: number;
  severity: CvssSeverity;
}

const AV_WEIGHTS: Record<string, number> = { N: 0.85, A: 0.62, L: 0.55, P: 0.2 };
const AC_WEIGHTS: Record<string, number> = { L: 0.77, H: 0.44 };
const PR_WEIGHTS_SCOPE_UNCHANGED: Record<string, number> = { N: 0.85, L: 0.62, H: 0.27 };
const PR_WEIGHTS_SCOPE_CHANGED: Record<string, number> = { N: 0.85, L: 0.68, H: 0.5 };
const UI_WEIGHTS: Record<string, number> = { N: 0.85, R: 0.62 };
const CIA_WEIGHTS: Record<string, number> = { N: 0, L: 0.22, H: 0.56 };
const SCOPE_VALUES = ["U", "C"];

const REQUIRED_METRICS = ["AV", "AC", "PR", "UI", "S", "C", "I", "A"] as const;
type MetricKey = (typeof REQUIRED_METRICS)[number];

/**
 * Roundup do Apêndice A da spec — aritmética em inteiros porque o
 * `Math.ceil(x * 10) / 10` do CVSS 3.0 erra quando o float representa o
 * valor um fio acima do real (0.1 + 0.2 = 0.30000000000000004 → 0.4).
 */
function roundUp(input: number): number {
  const intInput = Math.round(input * 100000);
  if (intInput % 10000 === 0) return intInput / 100000;
  return (Math.floor(intInput / 10000) + 1) / 10;
}

function parseVector(vector: string): Record<MetricKey, string> | null {
  if (!vector || typeof vector !== "string") return null;

  // Só CVSS 3.1. Prefixo de outra versão é recusado — nunca calculado com as
  // fórmulas do 3.1 em silêncio (idêntico ao backend).
  const prefixMatch = /^CVSS:(\d+\.\d+)\//.exec(vector);
  if (prefixMatch && prefixMatch[1] !== "3.1") return null;

  const withoutPrefix = vector.startsWith("CVSS:3.1/") ? vector.slice("CVSS:3.1/".length) : vector;
  const segments = withoutPrefix.split("/").filter(Boolean);
  const parsed: Partial<Record<MetricKey, string>> = {};

  for (const segment of segments) {
    const parts = segment.split(":");
    if (parts.length !== 2) return null;
    const [key, value] = parts;
    if (!REQUIRED_METRICS.includes(key as MetricKey)) return null;
    // `in` em vez de truthiness: "C:" grava "" (falsy) e a duplicata passaria.
    if (key in parsed) return null;
    parsed[key as MetricKey] = value;
  }

  for (const metric of REQUIRED_METRICS) {
    if (!parsed[metric]) return null;
  }

  return parsed as Record<MetricKey, string>;
}

function severityFromScore(score: number): CvssSeverity {
  if (score === 0) return "NONE";
  if (score <= 3.9) return "LOW";
  if (score <= 6.9) return "MEDIUM";
  if (score <= 8.9) return "HIGH";
  return "CRITICAL";
}

/** Retorna null quando o vetor é inválido/incompleto — o chamador decide como exibir isso. */
export function calculateCvss(vector: string): CvssResult | null {
  const metrics = parseVector(vector);
  if (!metrics) return null;
  if (!SCOPE_VALUES.includes(metrics.S)) return null;

  const scopeChanged = metrics.S === "C";
  const av = AV_WEIGHTS[metrics.AV];
  const ac = AC_WEIGHTS[metrics.AC];
  const pr = (scopeChanged ? PR_WEIGHTS_SCOPE_CHANGED : PR_WEIGHTS_SCOPE_UNCHANGED)[metrics.PR];
  const ui = UI_WEIGHTS[metrics.UI];
  const c = CIA_WEIGHTS[metrics.C];
  const i = CIA_WEIGHTS[metrics.I];
  const a = CIA_WEIGHTS[metrics.A];

  if ([av, ac, pr, ui, c, i, a].some((weight) => weight === undefined)) return null;

  const iscBase = 1 - (1 - c) * (1 - i) * (1 - a);
  const impact = scopeChanged
    ? 7.52 * (iscBase - 0.029) - 3.25 * (iscBase - 0.02) ** 15
    : 6.42 * iscBase;
  const exploitability = 8.22 * av * ac * pr * ui;

  if (impact <= 0) return { score: 0, severity: "NONE" };

  const rawScore = scopeChanged ? 1.08 * (impact + exploitability) : impact + exploitability;
  const score = roundUp(Math.min(rawScore, 10));

  return { score, severity: severityFromScore(score) };
}
