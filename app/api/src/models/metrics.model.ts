/**
 * metrics.model.ts
 *
 * O QUE FAZ
 * Tipos e DTOs das métricas analíticas por aplicação, mais a fórmula do risk
 * score — que fica aqui, e não no service, porque é a regra que a banca vai
 * perguntar e precisa ser encontrável.
 *
 * POR QUE ESTE RECURSO NÃO TEM ENTIDADE PRISMA
 * Diferente de Plan ou Vulnerability, "métrica" não é uma tabela: é uma
 * PROJEÇÃO calculada na hora a partir de `Vulnerability` e `AuditLog`. Por isso
 * o arquivo tem tipos e DTOs, mas nenhum `type Metrics = PrismaMetrics`. Mesmo
 * padrão do `report.model.ts` (Fase 6).
 *
 * DE ONDE VEM O HISTÓRICO (a pergunta central do CP4)
 * Não existe tabela de série temporal no schema, e a Fase 6.5 não criou
 * nenhuma — nenhuma migration foi necessária. As duas fontes são:
 *
 *   1. `Vulnerability.createdAt` → quando o finding nasceu.
 *   2. `AuditLog` com `action = "STATUS_CHANGE"` → quando mudou de estado.
 *      O `diffJson` guarda `{"from":"OPEN","to":"FIXED"}` — ou seja, o estado
 *      DESTINO está registrado (`vulnerability.service.ts`, linha ~235). É isso
 *      que torna MTTR e burndown reconstruíveis.
 *
 * ⚠️ LIMITE CONHECIDO: o `AuditLog` só passou a existir na Fase 3, e o
 * `STATUS_CHANGE` de Vulnerability na Fase 5. Um finding que tenha mudado de
 * estado antes disso não tem trilha — ele entra no cálculo de "aberto/fechado"
 * pelo estado ATUAL, mas não contribui para o MTTR. Registrado no ADR-025.
 *
 * QUEM USA
 * `metrics.repository.ts`, `metrics.service.ts`, `metrics.controller.ts` e o
 * frontend (dashboards da Fase 6.5).
 */

export type Severidade = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "NONE";
export type StatusFinding = "OPEN" | "IN_PROGRESS" | "FIXED" | "CLOSED";

export const SEVERIDADES: Severidade[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "NONE"];

/** Estados que contam como "remediado" na taxa de remediação. */
export const STATUS_REMEDIADO: StatusFinding[] = ["FIXED", "CLOSED"];

/** Estados que contam como "aberto" — o complemento dos remediados. */
export const STATUS_ABERTO: StatusFinding[] = ["OPEN", "IN_PROGRESS"];

export type Granularidade = "day" | "week" | "month";

/* ==========================================================================
   RISK SCORE — a fórmula
   ========================================================================== */

/**
 * Risco agregado dos findings ABERTOS de um recorte.
 *
 *     riskScore = Σ ( cvss² / 10 )
 *
 * POR QUE ESTA FÓRMULA
 *
 * 1. É SOMA, não média. Risco acumula: uma aplicação com 50 findings médios
 *    está pior que uma com 5. A média diria o contrário — e diria também que
 *    fechar um finding baixo "piora" a nota, o que é absurdo e destruiria a
 *    confiança no número na primeira vez que acontecesse.
 *
 * 2. É QUADRÁTICA, não linear. Um CVSS 9.8 não vale três CVSS 3.2, vale muito
 *    mais: o esforço de um atacante e o impacto de uma falha crescem bem mais
 *    rápido que a nota. Com o quadrado, um 10.0 pesa 25× um 2.0, o que é
 *    próximo de como uma equipe de segurança de fato prioriza.
 *
 * 3. É DIVIDIDA POR 10 para dar uma unidade legível: um finding de CVSS 10.0
 *    contribui com exatamente 10 pontos. "Esta aplicação tem 47 pontos de
 *    risco" se lê como "o equivalente a 4,7 críticos perfeitos em aberto".
 *
 * 4. SÓ CONTA ABERTOS (`OPEN`, `IN_PROGRESS`). Findings `FIXED`/`CLOSED` saem
 *    do numerador — é o que faz a linha do risk score CAIR quando o time
 *    trabalha, que é a única forma de o gráfico servir de motivação.
 *
 * O QUE ELA NÃO É: não é CVSS ambiental, não é uma métrica normalizada da
 * indústria e não é comparável com o "risk score" de nenhuma ferramenta
 * comercial. É uma métrica interna, e o valor dela está em ser CONSISTENTE ao
 * longo do tempo e ENTRE aplicações da mesma empresa.
 *
 * ⚠️ Finding sem `cvssScore` (nulo) contribui com 0. Não é omissão: sem vetor
 * não há como estimar, e chutar um valor seria pior que não contar.
 */
export function calcularRiskScore(cvssScores: (number | null)[]): number {
  const total = cvssScores.reduce<number>((acc, cvss) => {
    if (cvss == null || Number.isNaN(cvss)) return acc;
    return acc + (cvss * cvss) / 10;
  }, 0);
  // Duas casas: o número aparece em cartão de KPI e em eixo de gráfico, e
  // ponto flutuante cru produziria "47.300000000000004".
  return Math.round(total * 100) / 100;
}

/* ==========================================================================
   DTOs — summary
   ========================================================================== */

/** Contagem por chave. Chaves ausentes são preenchidas com 0 pelo service. */
export type ContagemPorChave = Record<string, number>;

/**
 * Buckets de idade dos findings ABERTOS — a métrica de "dívida de segurança".
 * As faixas seguem a prática usual de SLA: uma semana, um mês, um trimestre.
 */
export interface AgingDTO {
  ate7Dias: number;
  de7A30Dias: number;
  de30A90Dias: number;
  mais90Dias: number;
}

/** MTTR por severidade, em dias. `null` = não houve remediação no período. */
export interface MttrDTO {
  /** MEDIANA, não média — ver comentário em `metrics.service.ts`. */
  medianaDias: number | null;
  /** Quantas remediações entraram no cálculo. Sem isso a mediana não se defende. */
  amostras: number;
}

export interface DeltaDTO {
  atual: number;
  anterior: number;
  /** Diferença absoluta (atual − anterior). */
  variacao: number;
  /** Variação percentual. `null` quando o período anterior era zero. */
  variacaoPercentual: number | null;
}

export interface MetricsSummaryDTO {
  applicationId: string;
  periodo: { de: string; ate: string };
  totalFindings: number;
  abertosPorSeveridade: ContagemPorChave;
  totalAbertos: number;
  totalRemediados: number;
  /** (FIXED + CLOSED) / total, em 0–100. */
  taxaRemediacao: number;
  riskScore: number;
  mttrPorSeveridade: Record<string, MttrDTO>;
  aging: AgingDTO;
  porCategoriaOwasp: ContagemPorChave;
  /** Presente só quando `compare=previous`. */
  comparacao?: {
    periodoAnterior: { de: string; ate: string };
    totalFindings: DeltaDTO;
    totalAbertos: DeltaDTO;
    taxaRemediacao: DeltaDTO;
    riskScore: DeltaDTO;
  };
}

/* ==========================================================================
   DTOs — timeseries
   ========================================================================== */

export interface PontoDaSerie {
  /** Início do período, em ISO (YYYY-MM-DD). Sempre UTC — ver o repository. */
  periodo: string;
  criados: number;
  criadosPorSeveridade: ContagemPorChave;
  resolvidos: number;
  /** Findings abertos ACUMULADOS ao fim do período — a linha do burndown. */
  abertosAcumulados: number;
  riskScore: number;
}

export interface MetricsTimeseriesDTO {
  applicationId: string;
  periodo: { de: string; ate: string };
  granularidade: Granularidade;
  pontos: PontoDaSerie[];
}

/* ==========================================================================
   DTOs — insights
   ========================================================================== */

export type SeveridadeInsight = "positivo" | "neutro" | "atencao" | "critico";

export interface InsightDTO {
  id: string;
  severidade: SeveridadeInsight;
  texto: string;
  /**
   * Filtro que reproduz o recorte de onde o insight saiu, para o frontend
   * transformar em link (CP6). Ex: `{ severity: "CRITICAL", agingMin: 30 }`.
   */
  filtro?: Record<string, string | number>;
}

export interface MetricsInsightsDTO {
  applicationId: string;
  geradoEm: string;
  insights: InsightDTO[];
}

/* ==========================================================================
   DTOs — comparação entre aplicações
   ========================================================================== */

export interface LinhaComparativoDTO {
  applicationId: string;
  applicationName: string;
  riskScore: number;
  taxaRemediacao: number;
  criticosAbertos: number;
  totalFindings: number;
  totalAbertos: number;
  mttrGeralDias: number | null;
}

export interface MetricsComparisonDTO {
  companyId: string;
  periodo: { de: string; ate: string };
  aplicacoes: LinhaComparativoDTO[];
}

/* ==========================================================================
   Entity
   ========================================================================== */

/**
 * Não há entidade Prisma para serializar, mas o CLAUDE.md §14 proíbe devolver
 * tipo bruto. Esta classe existe para manter o contrato: o controller sempre
 * chama `.toResponse()`, e um campo novo que não esteja no DTO não vaza.
 */
export class MetricsEntity<T> {
  constructor(private readonly dados: T) {}
  toResponse(): T {
    return this.dados;
  }
}
