/**
 * metrics.types.ts
 *
 * Espelho dos DTOs de `app/api/src/models/metrics.model.ts`.
 *
 * ⚠️ Escritos à mão, não gerados. É a mesma escolha das Fases 3–6 (ver os
 * outros arquivos desta pasta): o projeto não tem geração de tipos a partir do
 * backend, e introduzir uma agora exigiria uma ferramenta e um passo de build
 * novos. O preço é este arquivo ficar desatualizado se o DTO mudar — mitigado
 * por os dois estarem no mesmo repositório e pelo `tsc` quebrar no consumo.
 */

export type Severidade = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "NONE";
export type Granularidade = "day" | "week" | "month";
export type SeveridadeInsight = "positivo" | "neutro" | "atencao" | "critico";

export type ContagemPorChave = Record<string, number>;

export interface Aging {
  ate7Dias: number;
  de7A30Dias: number;
  de30A90Dias: number;
  mais90Dias: number;
}

export interface Mttr {
  medianaDias: number | null;
  amostras: number;
}

export interface Delta {
  atual: number;
  anterior: number;
  variacao: number;
  variacaoPercentual: number | null;
}

export interface MetricsSummary {
  applicationId: string;
  periodo: { de: string; ate: string };
  totalFindings: number;
  abertosPorSeveridade: ContagemPorChave;
  totalAbertos: number;
  totalRemediados: number;
  taxaRemediacao: number;
  riskScore: number;
  mttrPorSeveridade: Record<string, Mttr>;
  aging: Aging;
  porCategoriaOwasp: ContagemPorChave;
  comparacao?: {
    periodoAnterior: { de: string; ate: string };
    totalFindings: Delta;
    totalAbertos: Delta;
    taxaRemediacao: Delta;
    riskScore: Delta;
  };
}

export interface PontoDaSerie {
  periodo: string;
  criados: number;
  criadosPorSeveridade: ContagemPorChave;
  resolvidos: number;
  abertosAcumulados: number;
  riskScore: number;
}

export interface MetricsTimeseries {
  applicationId: string;
  periodo: { de: string; ate: string };
  granularidade: Granularidade;
  pontos: PontoDaSerie[];
}

export interface Insight {
  id: string;
  severidade: SeveridadeInsight;
  texto: string;
  filtro?: Record<string, string | number>;
}

export interface MetricsInsights {
  applicationId: string;
  geradoEm: string;
  insights: Insight[];
}

export interface LinhaComparativo {
  applicationId: string;
  applicationName: string;
  riskScore: number;
  taxaRemediacao: number;
  criticosAbertos: number;
  totalFindings: number;
  totalAbertos: number;
  mttrGeralDias: number | null;
}

export interface MetricsComparison {
  companyId: string;
  periodo: { de: string; ate: string };
  aplicacoes: LinhaComparativo[];
}

/** Recorte enviado na query string. Espelha o `FiltroMetricas` do backend. */
export interface FiltroMetricas {
  from?: string;
  to?: string;
  severity?: string[];
  status?: string[];
  owasp?: string[];
  granularity?: Granularidade;
  compare?: boolean;
}
