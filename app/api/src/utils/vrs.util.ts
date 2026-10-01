/**
 * vrs.util.ts — Vulnera Risk Score (CP-3)
 *
 * O QUE FAZ
 * Calcula a PRIORIDADE CONTEXTUAL de um finding, 0–100, a partir do CVSS e do
 * contexto de risco da aplicação (CP-1). Função PURA, determinística e
 * explicável: a mesma entrada dá sempre a mesma saída, e a saída carrega cada
 * parcela que a compôs.
 *
 * O QUE ELE NÃO É
 *   - NÃO substitui o CVSS. O CVSS mede a FALHA (severidade técnica
 *     padronizada, RN10). O VRS mede a falha ONDE ELA ESTÁ. Os dois convivem
 *     em colunas diferentes e a UI mostra os dois.
 *   - NÃO tem tempo dentro. SLA é urgência temporal e fica em outra dimensão
 *     — somar prazo ao score faria o número gravado divergir do exibido só
 *     pela passagem do tempo (docs/DECISIONS.md D3).
 *   - NÃO olha `sourceType`. MANUAL e DAST_IMPORT são procedência, não
 *     severidade: um achado promovido do DAST teve o vetor revisado por
 *     humano (ADR-032) e não vale menos por ter nascido de ferramenta.
 *   - NÃO usa `severityFinal` no lugar do CVSS. O override de severidade muda
 *     o rótulo, não a nota; um override sem mudança de vetor NÃO mexe no VRS.
 *
 * FÓRMULA v1 — ADITIVA (D3 substituiu o modelo multiplicativo do relatório de
 * mapeamento, que saturava em 100 qualquer CVSS acima de ~4,5 num contexto
 * ruim e empatava todos os graves no topo):
 *
 *   base            = round(cvssScore × 6)          0–60   (o maior componente)
 *   criticality     LOW 0 · MEDIUM 5 · HIGH 10 · CRITICAL 15
 *   environment     DEV 0 · HOMOL 3 · PROD 7
 *   internetFacing  false 0 · true 8
 *   dataSensitivity PUBLIC 0 · INTERNAL 3 · CONFIDENTIAL 7 · RESTRICTED 10
 *   VRS             = clamp(0, 100, base + Σ parcelas)
 *
 * Teto teórico: 60 + 15 + 7 + 8 + 10 = 100 — só um CVSS 10.0 numa app crítica,
 * em produção, exposta, com dado restrito chega lá. Um 9.8 na mesma app dá 99;
 * o mesmo 9.8 numa app média, interna, em homologação, com dado interno dá 70.
 * É essa distância que o multiplicativo não conseguia manter.
 *
 * Valor de contexto fora do vocabulário (legado) conta 0 e é marcado no JSON
 * — inventar pontos para um valor que não se reconhece seria mentir.
 *
 * QUEM USA
 * `services/vulnerability.service.ts` (criação, mudança de vetor),
 * `services/dast-triage.service.ts` (promoção), o hook de recálculo em lote
 * de `services/application.service.ts` (mudança de contexto) e o backfill.
 */

export const VRS_FORMULA_VERSION = "v1";

export const CRITICALITY_POINTS: Record<string, number> = { LOW: 0, MEDIUM: 5, HIGH: 10, CRITICAL: 15 };
export const ENVIRONMENT_POINTS: Record<string, number> = { DEV: 0, HOMOL: 3, PROD: 7 };
export const INTERNET_FACING_POINTS = { false: 0, true: 8 } as const;
export const DATA_SENSITIVITY_POINTS: Record<string, number> = { PUBLIC: 0, INTERNAL: 3, CONFIDENTIAL: 7, RESTRICTED: 10 };
export const CVSS_MULTIPLIER = 6;

/** Faixas de prioridade — o rótulo que acompanha o número na UI. */
export const VRS_BANDS = [
  { min: 85, max: 100, label: "IMEDIATO" },
  { min: 65, max: 84, label: "URGENTE" },
  { min: 40, max: 64, label: "PLANEJADO" },
  { min: 0, max: 39, label: "MONITORAR" },
] as const;
export type VrsBand = (typeof VRS_BANDS)[number]["label"];

export function vrsBand(score: number): VrsBand {
  for (const b of VRS_BANDS) if (score >= b.min) return b.label;
  return "MONITORAR";
}

export interface VrsInput {
  cvssScore: number | null;
  criticality: string;
  environment: string;
  internetFacing: boolean;
  dataSensitivity: string;
}

export interface VrsFactor {
  name: "criticality" | "environment" | "internetFacing" | "dataSensitivity";
  value: string | boolean;
  points: number;
  /** true quando o valor não está no vocabulário e contou 0. */
  unknown?: boolean;
}

/** O que vai em `vrsFactors` (JSON) — explica o número inteiro, parcela a parcela. */
export interface VrsBreakdown {
  formula: typeof VRS_FORMULA_VERSION;
  cvss: number;
  basePoints: number;
  factors: VrsFactor[];
  /** Soma crua antes do clamp — igual ao score na v1 (o teto teórico é 100), mas fica registrado. */
  raw: number;
  score: number;
  band: VrsBand;
  computedAt: string;
}

export interface VrsResult {
  score: number;
  band: VrsBand;
  breakdown: VrsBreakdown;
}

function pontos(tabela: Record<string, number>, valor: string): { points: number; unknown: boolean } {
  const p = tabela[valor];
  return p === undefined ? { points: 0, unknown: true } : { points: p, unknown: false };
}

/**
 * Calcula o VRS. Devolve null quando não há CVSS — sem vetor não há como
 * priorizar, e zero seria um número mentindo que "não é nada".
 * `computedAt` entra por parâmetro para o resultado ser reproduzível em teste.
 */
export function calcularVrs(input: VrsInput, computedAt: Date = new Date()): VrsResult | null {
  if (input.cvssScore == null || Number.isNaN(input.cvssScore)) return null;

  const cvss = Math.min(10, Math.max(0, input.cvssScore));
  const basePoints = Math.round(cvss * CVSS_MULTIPLIER);

  const crit = pontos(CRITICALITY_POINTS, input.criticality);
  const env = pontos(ENVIRONMENT_POINTS, input.environment);
  const net = { points: input.internetFacing ? INTERNET_FACING_POINTS.true : INTERNET_FACING_POINTS.false, unknown: false };
  const data = pontos(DATA_SENSITIVITY_POINTS, input.dataSensitivity);

  const factors: VrsFactor[] = [
    { name: "criticality", value: input.criticality, points: crit.points, ...(crit.unknown ? { unknown: true } : {}) },
    { name: "environment", value: input.environment, points: env.points, ...(env.unknown ? { unknown: true } : {}) },
    { name: "internetFacing", value: input.internetFacing, points: net.points },
    {
      name: "dataSensitivity",
      value: input.dataSensitivity,
      points: data.points,
      ...(data.unknown ? { unknown: true } : {}),
    },
  ];

  const raw = basePoints + factors.reduce((acc, f) => acc + f.points, 0);
  const score = Math.max(0, Math.min(100, raw));
  const band = vrsBand(score);

  return {
    score,
    band,
    breakdown: {
      formula: VRS_FORMULA_VERSION,
      cvss,
      basePoints,
      factors,
      raw,
      score,
      band,
      computedAt: computedAt.toISOString(),
    },
  };
}
