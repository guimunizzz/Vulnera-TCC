/**
 * exposure-graph.types.ts
 *
 * Contrato de `GET /companies/me/exposure-graph` (Exposure Graph, CP-8): o
 * estado atual das aplicações ativas da empresa, com as vulnerabilidades
 * abertas (`OPEN`/`IN_PROGRESS`) por severidade e por categoria OWASP.
 */

export type SeveridadeVuln = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export interface CategoriaExposta {
  owaspCategory: string;
  abertas: number;
  piorSeveridade: SeveridadeVuln;
}

export interface VulnPrincipal {
  id: string;
  title: string;
  severityFinal: string;
  status: string;
  owaspCategory: string;
  /** Origem: MANUAL | DAST_IMPORT | SAST_IMPORT | SCA_IMPORT. */
  sourceType: string;
}

export interface AplicacaoExposta {
  id: string;
  name: string;
  url: string | null;
  environment: string;
  criticality: string;
  internetFacing: boolean;
  dataSensitivity: string;
  abertas: Record<SeveridadeVuln, number>;
  /** As mesmas abertas por origem (visão unificada); só origens com abertas. */
  abertasPorOrigem: Record<string, number>;
  totalAbertas: number;
  totalResolvidas: number;
  piorSeveridade: SeveridadeVuln | null;
  categorias: CategoriaExposta[];
  principais: VulnPrincipal[];
}

export interface ExposureGraph {
  companyId: string;
  geradoEm: string;
  aplicacoes: AplicacaoExposta[];
}

/* ==========================================================================
   Análises do Exposure Graph (ADR-061)
   ========================================================================== */

/** Contexto de negócio de uma aplicação, como as análises devolvem. */
export interface ContextoDaAplicacao {
  id: string;
  name: string;
  environment: string;
  criticality: string;
  internetFacing: boolean;
  dataSensitivity: string;
}

export type CodigoDoAgravante = "INTERNET" | "GRAVE" | "AMEACA_ATIVA" | "DADO_SENSIVEL" | "PRODUCAO";

export interface Agravante {
  codigo: CodigoDoAgravante;
  rotulo: string;
  /** O dado que comprova ("CVE-… no KEV desde …"). */
  detalhe?: string;
}

/** Combinação tóxica: fatores perigosos comprovados JUNTOS numa vulnerabilidade aberta (nunca "Attack Path", D8). */
export interface CombinacaoToxica {
  vulnerabilityId: string;
  title: string;
  severityFinal: string;
  owaspCategory: string;
  sourceType: string;
  vrsScore: number | null;
  aplicacao: ContextoDaAplicacao;
  advisory: { id: string; kev: boolean; epssPercentile: number | null } | null;
  agravantes: Agravante[];
}

export interface CombinacoesToxicas {
  companyId: string;
  geradoEm: string;
  criterio: { minimoDeAgravantes: number; limiarEpssPercentil: number };
  total: number;
  combinacoes: CombinacaoToxica[];
}

export type TipoDeImpacto = "PACOTE" | "CVE" | "CATEGORIA";

export interface OpcaoDeImpacto {
  tipo: TipoDeImpacto;
  valor: string;
  aplicacoes: number;
}

export interface AplicacaoAtingida extends ContextoDaAplicacao {
  ocorrencias: number;
  piorSeveridade: SeveridadeVuln | null;
  /** Versões (pacote) ou pacotes@versão (CVE). */
  detalhes: string[];
}

export interface Impacto {
  tipo: TipoDeImpacto;
  valor: string;
  aplicacoes: AplicacaoAtingida[];
  resumo: { aplicacoes: number; expostas: number; emProducao: number; ocorrencias: number };
}

export interface VulnerabilidadeNoHistorico {
  id: string;
  applicationId: string;
  title: string;
  owaspCategory: string;
  severityFinal: string;
  sourceType: string;
  /** Status hoje — vale para quem não tem trilha de mudanças. */
  status: string;
  createdAt: string;
  mudancas: Array<{ em: string; para: string }>;
}

export interface HistoricoDaExposicao {
  companyId: string;
  geradoEm: string;
  inicio: string | null;
  vulnerabilidades: VulnerabilidadeNoHistorico[];
}
