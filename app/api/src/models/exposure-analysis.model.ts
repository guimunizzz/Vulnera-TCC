/**
 * exposure-analysis.model.ts
 *
 * O QUE FAZ
 * Tipos, DTOs e as REGRAS PURAS das três análises sobre o Exposure Graph
 * (ADR-061):
 *
 *   Combinações tóxicas  vulnerabilidades abertas em que vários agravantes
 *                        COMPROVADOS coincidem (Internet, gravidade, ameaça
 *                        ativa, dado sensível, produção)
 *   Raio de impacto      onde mais um pacote, uma CVE ou uma categoria OWASP
 *                        aparece — aplicação por aplicação
 *   Histórico            criação e mudanças de status para a "máquina do
 *                        tempo" reconstruir o grafo num instante passado
 *
 * NOME (DECISIONS D8)
 * "Combinações tóxicas", nunca "Attack Path": o Vulnera não coleta topologia,
 * identidades nem permissões efetivas, então não afirma que um atacante
 * percorre um caminho. Afirma que fatores perigosos estão JUNTOS na mesma
 * vulnerabilidade — e cada fator é uma relação do modelo (D9):
 *
 *   Internet ........ Application.internetFacing
 *   Gravidade ....... Vulnerability.severityFinal
 *   Ameaça ativa .... ThreatAdvisory.kev / epssPercentile, alcançado pela
 *                     origem da vulnerabilidade (CodeFinding.advisoryId ou
 *                     ThreatMatch.advisoryId). Manual e DAST não têm CVE: entram
 *                     sem este fator (D22.2).
 *   Dado sensível ... Application.dataSensitivity
 *   Produção ........ Application.environment
 *
 * O VRS (ADR-035) já soma o CONTEXTO (criticidade, ambiente, Internet) e
 * continua sendo o desempate; a combinação acrescenta a dimensão de AMEAÇA,
 * que o VRS não tem, e é categórica — "estes fatores estão juntos".
 *
 * QUEM USA
 * `exposure-analysis.service.ts` e os testes de unidade.
 */

import { SEVERIDADES_DO_GRAFO, type SeveridadeDoGrafo } from "./exposure-graph.model";

/* ==========================================================================
   Combinações tóxicas
   ========================================================================== */

export type CodigoDoAgravante = "INTERNET" | "GRAVE" | "AMEACA_ATIVA" | "DADO_SENSIVEL" | "PRODUCAO";

export interface AgravanteDTO {
  codigo: CodigoDoAgravante;
  /** Texto curto para o chip ("Exposta à Internet"). */
  rotulo: string;
  /** O dado que comprova ("KEV desde 2024-03-12", "EPSS no percentil 97"). */
  detalhe?: string;
}

/** EPSS conta como ameaça ativa a partir deste percentil (os 10% mais prováveis de exploração). */
export const LIMIAR_EPSS_PERCENTIL = 0.9;
/** Quantos agravantes, no mínimo, fazem uma combinação tóxica (Internet e gravidade sempre entre eles). */
export const MINIMO_DE_AGRAVANTES = 3;
/** Quantas combinações a resposta traz: é lista de prioridade, não inventário. */
export const LIMITE_DE_COMBINACOES = 50;

const SEVERIDADES_GRAVES: ReadonlySet<string> = new Set(["CRITICAL", "HIGH"]);
const DADOS_SENSIVEIS: ReadonlySet<string> = new Set(["CONFIDENTIAL", "RESTRICTED"]);
const RANK_SEVERIDADE: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

export interface ContextoDaAplicacao {
  id: string;
  name: string;
  environment: string;
  criticality: string;
  internetFacing: boolean;
  dataSensitivity: string;
}

export interface AmeacaDoAdvisory {
  id: string;
  kev: boolean;
  kevAddedAt: Date | null;
  epssScore: number | null;
  epssPercentile: number | null;
}

export interface VulnerabilidadeCandidata {
  id: string;
  title: string;
  severityFinal: string;
  owaspCategory: string;
  sourceType: string;
  vrsScore: number | null;
  createdAt: Date;
  aplicacao: ContextoDaAplicacao;
  /** Advisory da origem (SCA/Threat Intel); null para manual e DAST. */
  ameaca: AmeacaDoAdvisory | null;
}

export interface CombinacaoToxicaDTO {
  vulnerabilityId: string;
  title: string;
  severityFinal: string;
  owaspCategory: string;
  sourceType: string;
  vrsScore: number | null;
  aplicacao: ContextoDaAplicacao;
  advisory: { id: string; kev: boolean; epssPercentile: number | null } | null;
  agravantes: AgravanteDTO[];
}

export interface CombinacoesToxicasDTO {
  companyId: string;
  geradoEm: string;
  /** A regra, devolvida junto para a tela explicar o critério. */
  criterio: { minimoDeAgravantes: number; limiarEpssPercentil: number };
  /** Quantas vulnerabilidades atendem ao critério (a lista pode vir cortada). */
  total: number;
  combinacoes: CombinacaoToxicaDTO[];
}

const dataCurta = (data: Date) => data.toISOString().slice(0, 10);

/** Os agravantes comprovados de uma vulnerabilidade aberta, na ordem de leitura. */
export function agravantesDe(v: VulnerabilidadeCandidata): AgravanteDTO[] {
  const lista: AgravanteDTO[] = [];
  if (v.aplicacao.internetFacing) lista.push({ codigo: "INTERNET", rotulo: "Exposta à Internet" });
  if (SEVERIDADES_GRAVES.has(v.severityFinal)) {
    lista.push({ codigo: "GRAVE", rotulo: v.severityFinal === "CRITICAL" ? "Severidade crítica" : "Severidade alta" });
  }
  if (v.ameaca?.kev) {
    lista.push({
      codigo: "AMEACA_ATIVA",
      rotulo: "Explorada (KEV)",
      detalhe: v.ameaca.kevAddedAt ? `${v.ameaca.id} no KEV desde ${dataCurta(v.ameaca.kevAddedAt)}` : `${v.ameaca.id} no KEV`,
    });
  } else if (v.ameaca?.epssPercentile != null && v.ameaca.epssPercentile >= LIMIAR_EPSS_PERCENTIL) {
    lista.push({
      codigo: "AMEACA_ATIVA",
      rotulo: "Provável exploração (EPSS)",
      detalhe: `${v.ameaca.id} no percentil ${Math.round(v.ameaca.epssPercentile * 100)} do EPSS`,
    });
  }
  if (DADOS_SENSIVEIS.has(v.aplicacao.dataSensitivity)) {
    lista.push({ codigo: "DADO_SENSIVEL", rotulo: v.aplicacao.dataSensitivity === "RESTRICTED" ? "Dados restritos" : "Dados confidenciais" });
  }
  if (v.aplicacao.environment === "PROD") lista.push({ codigo: "PRODUCAO", rotulo: "Em produção" });
  return lista;
}

/**
 * Tóxica = Internet E gravidade E pelo menos mais um agravante. Internet e
 * gravidade são obrigatórias: sem exposição não há porta de entrada, e uma
 * vulnerabilidade baixa não vira prioridade só pelo contexto.
 */
export function ehToxica(agravantes: AgravanteDTO[]): boolean {
  const codigos = new Set(agravantes.map((a) => a.codigo));
  return codigos.has("INTERNET") && codigos.has("GRAVE") && agravantes.length >= MINIMO_DE_AGRAVANTES;
}

/**
 * Ordem de prioridade: mais agravantes; ameaça ativa (KEV antes de EPSS);
 * VRS; severidade; a mais antiga primeiro (está aberta há mais tempo).
 */
export function compararCombinacoes(
  a: { agravantes: AgravanteDTO[]; advisory: { kev: boolean } | null; vrsScore: number | null; severityFinal: string; createdAt: Date; id: string },
  b: { agravantes: AgravanteDTO[]; advisory: { kev: boolean } | null; vrsScore: number | null; severityFinal: string; createdAt: Date; id: string },
): number {
  const ameaca = (x: typeof a) => (x.advisory?.kev ? 2 : x.agravantes.some((g) => g.codigo === "AMEACA_ATIVA") ? 1 : 0);
  return (
    b.agravantes.length - a.agravantes.length ||
    ameaca(b) - ameaca(a) ||
    (b.vrsScore ?? -1) - (a.vrsScore ?? -1) ||
    (RANK_SEVERIDADE[a.severityFinal] ?? 9) - (RANK_SEVERIDADE[b.severityFinal] ?? 9) ||
    a.createdAt.getTime() - b.createdAt.getTime() ||
    a.id.localeCompare(b.id)
  );
}

/** Aplica a regra a todas as candidatas: filtra, ordena e corta. */
export function montarCombinacoes(candidatas: VulnerabilidadeCandidata[]): { total: number; combinacoes: CombinacaoToxicaDTO[] } {
  const toxicas = candidatas
    .map((v) => ({ v, agravantes: agravantesDe(v) }))
    .filter(({ agravantes }) => ehToxica(agravantes))
    .map(({ v, agravantes }) => ({
      id: v.id,
      createdAt: v.createdAt,
      vrsScore: v.vrsScore,
      severityFinal: v.severityFinal,
      agravantes,
      advisory: v.ameaca ? { id: v.ameaca.id, kev: v.ameaca.kev, epssPercentile: v.ameaca.epssPercentile } : null,
      v,
    }))
    .sort(compararCombinacoes);

  return {
    total: toxicas.length,
    combinacoes: toxicas.slice(0, LIMITE_DE_COMBINACOES).map(({ v, agravantes, advisory }) => ({
      vulnerabilityId: v.id,
      title: v.title,
      severityFinal: v.severityFinal,
      owaspCategory: v.owaspCategory,
      sourceType: v.sourceType,
      vrsScore: v.vrsScore,
      aplicacao: v.aplicacao,
      advisory,
      agravantes,
    })),
  };
}

/* ==========================================================================
   Raio de impacto
   ========================================================================== */

export const TIPOS_DE_IMPACTO = ["PACOTE", "CVE", "CATEGORIA"] as const;
export type TipoDeImpacto = (typeof TIPOS_DE_IMPACTO)[number];

/** Uma ocorrência do alvo numa aplicação (uma linha do banco). */
export interface OcorrenciaDeImpacto {
  applicationId: string;
  severidade: string;
  /** Versão do pacote, quando o alvo é pacote ou CVE. */
  versao?: string | null;
  /** Pacote, quando o alvo é CVE (qual dependência traz a CVE). */
  pacote?: string | null;
}

export interface AplicacaoAtingidaDTO extends ContextoDaAplicacao {
  ocorrencias: number;
  piorSeveridade: SeveridadeDoGrafo | null;
  /** Versões (pacote) ou pacotes (CVE) em que o alvo aparece nesta aplicação. */
  detalhes: string[];
}

export interface ImpactoDTO {
  tipo: TipoDeImpacto;
  valor: string;
  aplicacoes: AplicacaoAtingidaDTO[];
  resumo: { aplicacoes: number; expostas: number; emProducao: number; ocorrencias: number };
}

export interface OpcaoDeImpactoDTO {
  tipo: TipoDeImpacto;
  valor: string;
  /** Em quantas aplicações ativas o alvo aparece hoje. */
  aplicacoes: number;
}

const ehSeveridadeDoGrafo = (s: string): s is SeveridadeDoGrafo => (SEVERIDADES_DO_GRAFO as readonly string[]).includes(s);

/**
 * Agrupa as ocorrências por aplicação ativa. Ocorrência de aplicação que não
 * está na lista (inativa, de outra company) é descartada aqui — a segunda
 * barreira depois do filtro por company no repository.
 */
export function montarImpacto(tipo: TipoDeImpacto, valor: string, aplicacoes: ContextoDaAplicacao[], ocorrencias: OcorrenciaDeImpacto[]): ImpactoDTO {
  const porId = new Map(aplicacoes.map((a) => [a.id, a]));
  const grupos = new Map<string, { ocorrencias: number; pior: SeveridadeDoGrafo | null; detalhes: Set<string> }>();

  for (const o of ocorrencias) {
    if (!porId.has(o.applicationId)) continue;
    const g = grupos.get(o.applicationId) ?? { ocorrencias: 0, pior: null, detalhes: new Set<string>() };
    g.ocorrencias += 1;
    const sev = o.severidade.toUpperCase();
    if (ehSeveridadeDoGrafo(sev) && (g.pior === null || RANK_SEVERIDADE[sev] < RANK_SEVERIDADE[g.pior])) g.pior = sev;
    const detalhe = tipo === "CVE" ? (o.pacote ? `${o.pacote}${o.versao ? `@${o.versao}` : ""}` : null) : o.versao;
    if (detalhe) g.detalhes.add(detalhe);
    grupos.set(o.applicationId, g);
  }

  const atingidas = [...grupos.entries()]
    .map(([id, g]): AplicacaoAtingidaDTO => ({
      ...porId.get(id)!,
      ocorrencias: g.ocorrencias,
      piorSeveridade: g.pior,
      detalhes: [...g.detalhes].sort(),
    }))
    .sort(
      (a, b) =>
        Number(b.internetFacing) - Number(a.internetFacing) ||
        (RANK_SEVERIDADE[a.piorSeveridade ?? ""] ?? 9) - (RANK_SEVERIDADE[b.piorSeveridade ?? ""] ?? 9) ||
        b.ocorrencias - a.ocorrencias ||
        a.name.localeCompare(b.name),
    );

  return {
    tipo,
    valor,
    aplicacoes: atingidas,
    resumo: {
      aplicacoes: atingidas.length,
      expostas: atingidas.filter((a) => a.internetFacing).length,
      emProducao: atingidas.filter((a) => a.environment === "PROD").length,
      ocorrencias: atingidas.reduce((s, a) => s + a.ocorrencias, 0),
    },
  };
}

/** Normaliza o valor pedido: categoria e CVE em maiúsculas; pacote como veio (npm diferencia). */
export function normalizarValorDeImpacto(tipo: TipoDeImpacto, valor: string): string {
  const limpo = valor.trim();
  return tipo === "PACOTE" ? limpo : limpo.toUpperCase();
}

/* ==========================================================================
   Histórico (máquina do tempo)
   ========================================================================== */

export interface VulnerabilidadeNoHistoricoDTO {
  id: string;
  applicationId: string;
  title: string;
  owaspCategory: string;
  severityFinal: string;
  sourceType: string;
  /** Status hoje — vale para quem não tem trilha de mudanças. */
  status: string;
  createdAt: string;
  /** Mudanças de status em ordem cronológica (AuditLog STATUS_CHANGE). */
  mudancas: Array<{ em: string; para: string }>;
}

export interface HistoricoDaExposicaoDTO {
  companyId: string;
  geradoEm: string;
  /** A data mais antiga com dado (criação da primeira vulnerabilidade). */
  inicio: string | null;
  vulnerabilidades: VulnerabilidadeNoHistoricoDTO[];
}

/**
 * Lê o destino de um `diffJson` de STATUS_CHANGE (`{"from":"OPEN","to":"FIXED"}`).
 * Texto que não é JSON ou sem `to` vira null — o AuditLog é compartilhado por
 * todas as ações, e uma linha malformada não pode derrubar o histórico.
 */
export function destinoDaMudanca(diffJson: string | null): string | null {
  if (!diffJson) return null;
  try {
    const diff = JSON.parse(diffJson) as { to?: unknown };
    return typeof diff.to === "string" ? diff.to : null;
  } catch {
    return null;
  }
}
