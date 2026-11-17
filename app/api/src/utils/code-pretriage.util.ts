/**
 * code-pretriage.util.ts
 *
 * O QUE FAZ
 * Pré-triagem dos achados SAST/SCA importados: diz ONDE o achado está
 * (código de produção, teste, fixture, documentação, artefato gerado, script)
 * e quais SINAIS de outras fontes apontam que ele é real — e, a partir disso,
 * uma SUGESTÃO para quem tria: "falso-positivo: fora do código de produção" ou
 * "provável vulnerabilidade".
 *
 * POR QUE É SÓ SUGESTÃO
 * ADR-032/ADR-052 + RN10: achado de ferramenta só vira finding do produto
 * depois que um humano decide, e o CVSS da Vulnerability é o vetor que o
 * humano confirmou. A pré-triagem encurta o caminho — aceitar em lote, rascunho
 * já preenchido — mas não decide nada sozinha.
 *
 * POR QUE É CALCULADA NA LEITURA (e não gravada na importação)
 * O contexto é função pura do caminho; os sinais vêm de dados que mudam depois
 * da importação (CVE entra no catálogo KEV, EPSS sobe, alguém promove uma
 * vulnerabilidade DAST na mesma aplicação). Calculando na leitura, uma
 * importação antiga ganha o sinal novo sem reprocessamento nem migration.
 *
 * Funções puras: os dados de outras fontes chegam prontos do service.
 */

import type { DastTriageStatus } from "@prisma/client";

export type CodeContext = "PRODUCAO" | "TESTE" | "FIXTURE" | "DOCUMENTACAO" | "GERADO" | "SCRIPT";

export const CONTEXT_LABELS: Record<CodeContext, string> = {
  PRODUCAO: "código de produção",
  TESTE: "arquivo de teste",
  FIXTURE: "fixture/dado de teste",
  DOCUMENTACAO: "documentação",
  GERADO: "artefato gerado (build, relatório, dependência)",
  SCRIPT: "script/seed de desenvolvimento",
};

/*
 * Ordem importa: o primeiro que casa vence. Artefato gerado antes de teste
 * (`output/qa/browser-test.cjs` é saída, não teste); fixture antes de teste
 * (`tests/fixtures/x.sarif` é dado, não código de teste).
 */
const REGRAS_DE_CONTEXTO: Array<[Exclude<CodeContext, "PRODUCAO">, RegExp[]]> = [
  [
    "GERADO",
    [
      /(^|\/)(output|dist|build|out|coverage|\.next|\.nuxt|vendor|node_modules|generated|__generated__|target|\.cache)\//i,
      /\.min\.(js|css)$/i,
      /\.map$/i,
    ],
  ],
  ["FIXTURE", [/(^|\/)(fixtures?|__fixtures__|testdata|test-data|__mocks__|mocks?|stubs?)\//i]],
  [
    "TESTE",
    [
      /(^|\/)(tests?|__tests__|spec|specs|e2e|cypress|playwright)\//i,
      /\.(test|spec|e2e)\.[cm]?[jt]sx?$/i,
      /(^|\/)test_[^/]+\.py$/i,
      /_test\.(py|go)$/i,
      /Tests?\.(java|kt|cs)$/,
    ],
  ],
  ["DOCUMENTACAO", [/(^|\/)(docs?|documentation|examples?|samples?)\//i]],
  ["SCRIPT", [/(^|\/)(scripts?|seeds?)\//i, /(^|\/)(seed|backfill)[^/]*\.[cm]?[jt]s$/i]],
];

/** SCA (sem caminho) conta como produção: a dependência vai junto com a aplicação. */
export function classificarContexto(filePath: string | null): CodeContext {
  if (!filePath) return "PRODUCAO";
  const p = filePath.replace(/\\/g, "/");
  for (const [contexto, padroes] of REGRAS_DE_CONTEXTO) {
    if (padroes.some((re) => re.test(p))) return contexto;
  }
  return "PRODUCAO";
}

// ============================================================================
// Sinais de outras fontes
// ============================================================================

/** EPSS ≥ 10%: probabilidade de exploração nos próximos 30 dias que o FIRST trata como alta. */
export const EPSS_LIMIAR = 0.1;

export interface AdvisorySignalInput {
  id: string;
  kev: boolean;
  kevRansomware: boolean;
  epssScore: number | null;
  /** Vetor do NVD: ponto de partida do rascunho quando o relatório não trouxe vetor. */
  cvssVector: string | null;
  /** A empresa tem a mesma CVE casada no inventário do Threat Intel (ThreatMatch). */
  noInventario: boolean;
}

export interface DastConfirmadoInput {
  vulnerabilityId: string;
  title: string;
  cweId: string;
}

export type CodeSignalKind = "KEV" | "EPSS" | "DAST_CONFIRMADO" | "THREAT_INTEL";

export interface CodeSignal {
  tipo: CodeSignalKind;
  /** Forte = sozinho já basta para sugerir "provável vulnerabilidade". */
  forte: boolean;
  detalhe: string;
  /** Vulnerability relacionada, quando o sinal veio de uma (DAST confirmado). */
  vulnerabilityId?: string;
}

export interface CodeSuggestion {
  tipo: "FALSO_POSITIVO" | "PROVAVEL_VULNERABILIDADE";
  motivo: string;
}

export interface PreTriagem {
  contexto: CodeContext;
  sinais: CodeSignal[];
  /** Só para achados ainda NEW: triagem já feita é decisão humana, não se sugere por cima. */
  sugestao: CodeSuggestion | null;
}

interface FindingInput {
  filePath: string | null;
  cweId: string | null;
  advisoryId: string | null;
  triageStatus: DastTriageStatus;
}

export interface SignalSources {
  advisories: Map<string, AdvisorySignalInput>;
  /** Vulnerabilities DAST da mesma aplicação, por CWE. */
  dastPorCwe: Map<string, DastConfirmadoInput[]>;
}

export function sinaisDoAchado(f: FindingInput, fontes: SignalSources): CodeSignal[] {
  const sinais: CodeSignal[] = [];
  const adv = f.advisoryId ? fontes.advisories.get(f.advisoryId.toUpperCase()) : undefined;
  if (adv) {
    if (adv.kev) {
      sinais.push({
        tipo: "KEV",
        forte: true,
        detalhe: `${adv.id} está no catálogo CISA KEV: exploração ativa confirmada${adv.kevRansomware ? ", inclusive por ransomware" : ""}.`,
      });
    }
    if (adv.epssScore !== null && adv.epssScore >= EPSS_LIMIAR) {
      sinais.push({
        tipo: "EPSS",
        forte: true,
        detalhe: `EPSS ${(adv.epssScore * 100).toFixed(1)}%: alta probabilidade de exploração nos próximos 30 dias.`,
      });
    }
    if (adv.noInventario) {
      sinais.push({ tipo: "THREAT_INTEL", forte: false, detalhe: `${adv.id} também foi casada no inventário de tecnologias da empresa (Threat Intel).` });
    }
  }
  const dast = f.cweId ? fontes.dastPorCwe.get(f.cweId) : undefined;
  if (dast && dast.length > 0) {
    const v = dast[0];
    sinais.push({
      tipo: "DAST_CONFIRMADO",
      forte: true,
      detalhe:
        `O DAST já confirmou CWE-${f.cweId} nesta aplicação ("${v.title}"` +
        (dast.length > 1 ? ` e mais ${dast.length - 1}` : "") +
        "): o mesmo tipo de falha visto no código.",
      vulnerabilityId: v.vulnerabilityId,
    });
  }
  return sinais;
}

export function preTriar(f: FindingInput, fontes: SignalSources): PreTriagem {
  const contexto = classificarContexto(f.filePath);
  const sinais = sinaisDoAchado(f, fontes);
  if (f.triageStatus !== "NEW") return { contexto, sinais, sugestao: null };

  if (contexto !== "PRODUCAO") {
    return { contexto, sinais, sugestao: { tipo: "FALSO_POSITIVO", motivo: `Fora do código de produção: ${CONTEXT_LABELS[contexto]}.` } };
  }
  const fortes = sinais.filter((s) => s.forte);
  if (fortes.length > 0) {
    return {
      contexto,
      sinais,
      sugestao: { tipo: "PROVAVEL_VULNERABILIDADE", motivo: fortes.map((s) => s.tipo === "DAST_CONFIRMADO" ? "confirmado pelo DAST" : s.tipo === "KEV" ? "explorada ativamente (KEV)" : "EPSS alto").join(" · ") },
    };
  }
  return { contexto, sinais, sugestao: null };
}

/** Nota gravada na triagem quando a sugestão de falso-positivo é aceita em lote. */
export function notaDaSugestaoAceita(contexto: CodeContext): string {
  return `Pré-triagem aceita: fora do código de produção (${CONTEXT_LABELS[contexto]}).`;
}
