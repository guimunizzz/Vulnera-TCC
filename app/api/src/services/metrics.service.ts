/**
 * metrics.service.ts
 *
 * O QUE FAZ
 * As regras de negócio das métricas: quem pode ver o quê, como o período é
 * resolvido, como o burndown é acumulado e como os insights são derivados.
 *
 * O QUE NÃO FAZ
 * Nenhuma agregação. Somar, agrupar e contar é trabalho do
 * `metrics.repository.ts`, que faz isso no banco. Aqui só entra aritmética
 * sobre números JÁ agregados (mediana de uma lista pequena, soma acumulada de
 * uma série de no máximo ~90 pontos) e a montagem das frases dos insights.
 *
 * ISOLAMENTO MULTI-TENANT
 * Mesma regra das Fases 3–5, sem exceção:
 *   ADMIN     → qualquer aplicação
 *   CLIENT    → só aplicações da própria company (RN16)
 *   PENTESTER → só aplicações onde é membro de algum projeto (RN17)
 * Violação lança `FORBIDDEN` → 403, mantendo a consistência com TEN-01..13 e
 * com a limitação L-04 do BACKLOG (403 e não 404, por decisão registrada).
 *
 * QUEM USA
 * `metrics.controller.ts`, via `metrics.factory.ts`.
 */

import type { MetricsRepository, FiltroMetricas } from "../repositories/metrics.repository";
import type { ApplicationRepository } from "../repositories/application.repository";
import type { ProjectRepository } from "../repositories/project.repository";
import type { ProjectMemberRepository } from "../repositories/project-member.repository";
import type { UserRepository } from "../repositories/user.repository";
import type { UserRole } from "../models/user.model";
import {
  calcularRiskScore,
  SEVERIDADES,
  type AgingDTO,
  type ContagemPorChave,
  type DeltaDTO,
  type Granularidade,
  type InsightDTO,
  type LinhaComparativoDTO,
  type MetricsComparisonDTO,
  type MetricsInsightsDTO,
  type MetricsSummaryDTO,
  type MetricsTimeseriesDTO,
  type MttrDTO,
  type PontoDaSerie,
} from "../models/metrics.model";

interface Actor {
  userId: string;
  role: UserRole;
}

export interface OpcoesPeriodo {
  de?: Date;
  ate?: Date;
  severidades?: string[];
  status?: string[];
  owasp?: string[];
}

/** Nome legível das categorias OWASP, para os insights não falarem em código. */
const NOME_OWASP: Record<string, string> = {
  A01: "A01 Broken Access Control",
  A02: "A02 Cryptographic Failures",
  A03: "A03 Injection",
  A04: "A04 Insecure Design",
  A05: "A05 Security Misconfiguration",
  A06: "A06 Vulnerable and Outdated Components",
  A07: "A07 Identification and Authentication Failures",
  A08: "A08 Software and Data Integrity Failures",
  A09: "A09 Security Logging and Monitoring Failures",
  A10: "A10 Server-Side Request Forgery",
};

const ROTULO_SEVERIDADE: Record<string, string> = {
  CRITICAL: "críticos",
  HIGH: "altos",
  MEDIUM: "médios",
  LOW: "baixos",
  NONE: "informativos",
};

const DIA_MS = 86_400_000;

export class MetricsService {
  constructor(
    private readonly repository: MetricsRepository,
    private readonly applicationRepository: ApplicationRepository,
    private readonly projectRepository: ProjectRepository,
    private readonly projectMemberRepository: ProjectMemberRepository,
    private readonly userRepository: UserRepository,
  ) {}

  /* ======================================================================
     Controle de acesso
     ====================================================================== */

  /** Devolve a aplicação se o ator puder vê-la; senão lança. */
  private async assertPodeVerAplicacao(actor: Actor, applicationId: string) {
    const application = await this.applicationRepository.findById(applicationId);
    if (!application) throw new Error("APPLICATION_NOT_FOUND");

    if (actor.role === "ADMIN") return application;

    if (actor.role === "CLIENT") {
      // O `companyId` NÃO vem no JWT (o `authMiddleware` popula só
      // `{userId, role}` — CLAUDE.md §8), então é carregado do banco, exatamente
      // como fazem application.service e report.service. Confiar num companyId
      // vindo do token seria pior: bastaria um refresh desatualizado depois de
      // a pessoa trocar de empresa para o isolamento vazar.
      const user = await this.userRepository.findById(actor.userId);
      if (!user?.companyId || user.companyId !== application.companyId) throw new Error("FORBIDDEN");
      return application;
    }

    // PENTESTER: precisa ser membro do projeto desta aplicação (RN17).
    // `findByApplication` devolve UM projeto, não uma lista — Project é 1-para-1
    // com Application desde o ADR-002.
    const projeto = await this.projectRepository.findByApplication(applicationId);
    if (!projeto) throw new Error("FORBIDDEN");
    const membros = await this.projectMemberRepository.findByProject(projeto.id);
    if (!membros.some((m) => m.userId === actor.userId)) throw new Error("FORBIDDEN");
    return application;
  }

  /* ======================================================================
     Período e granularidade
     ====================================================================== */

  /**
   * Resolve a janela pedida.
   *
   * Sem `de`, o padrão é 90 dias — é a janela em que um burndown já mostra
   * tendência sem ficar ilegível de tão longo. Sem `ate`, é agora.
   */
  private async resolverPeriodo(applicationId: string, opcoes: OpcoesPeriodo, agora: Date) {
    const ate = opcoes.ate ?? agora;
    let de = opcoes.de;
    if (!de) {
      const primeiro = await this.repository.dataDoPrimeiroFinding(applicationId);
      const noventaDiasAtras = new Date(ate.getTime() - 90 * DIA_MS);
      // Se a aplicação é mais nova que 90 dias, começa no primeiro finding —
      // senão o gráfico abre com semanas vazias antes de a aplicação existir.
      de = primeiro && primeiro > noventaDiasAtras ? primeiro : noventaDiasAtras;
    }
    return { de, ate };
  }

  /**
   * Granularidade automática pelo tamanho da janela.
   * ≤31d → dia · ≤180d → semana · acima → mês.
   *
   * O critério é a LEGIBILIDADE do eixo: acima de ~31 pontos as etiquetas
   * começam a se sobrepor, e um gráfico de 365 barras diárias não é um
   * gráfico, é uma textura.
   */
  granularidadeAutomatica(de: Date, ate: Date): Granularidade {
    const dias = Math.ceil((ate.getTime() - de.getTime()) / DIA_MS);
    if (dias <= 31) return "day";
    if (dias <= 180) return "week";
    return "month";
  }

  /* ======================================================================
     Summary
     ====================================================================== */

  async getSummary(
    actor: Actor,
    applicationId: string,
    opcoes: OpcoesPeriodo,
    compararComAnterior: boolean,
    agora: Date = new Date(),
  ): Promise<MetricsSummaryDTO> {
    await this.assertPodeVerAplicacao(actor, applicationId);
    const { de, ate } = await this.resolverPeriodo(applicationId, opcoes, agora);
    // ⚠️ O spread vem ANTES de `de`/`ate`, e a ordem não é estética.
    // `opcoes` carrega `de`/`ate` possivelmente `undefined` (quando a query
    // string não os traz), e com o spread por último eles sobrescreveriam as
    // datas já resolvidas. O Prisma ignora `undefined` num `where` e o bug
    // passaria despercebido nas contagens — mas em SQL cru `createdAt >= NULL`
    // não casa NADA, e as agregações de risco e aging zeravam em silêncio.
    const filtro: FiltroMetricas = { ...opcoes, applicationId, de, ate };

    const bloco = await this.calcularBloco(filtro, agora);

    const dto: MetricsSummaryDTO = {
      applicationId,
      periodo: { de: de.toISOString(), ate: ate.toISOString() },
      ...bloco,
    };

    if (compararComAnterior) {
      // Período anterior de MESMO TAMANHO, imediatamente antes. Comparar com
      // um período de tamanho diferente produziria deltas sem sentido.
      const duracao = ate.getTime() - de.getTime();
      const anteriorAte = new Date(de.getTime() - 1);
      const anteriorDe = new Date(anteriorAte.getTime() - duracao);
      const anterior = await this.calcularBloco({ ...filtro, de: anteriorDe, ate: anteriorAte }, agora);

      dto.comparacao = {
        periodoAnterior: { de: anteriorDe.toISOString(), ate: anteriorAte.toISOString() },
        totalFindings: delta(bloco.totalFindings, anterior.totalFindings),
        totalAbertos: delta(bloco.totalAbertos, anterior.totalAbertos),
        taxaRemediacao: delta(bloco.taxaRemediacao, anterior.taxaRemediacao),
        riskScore: delta(bloco.riskScore, anterior.riskScore),
      };
    }

    return dto;
  }

  /** As métricas de uma janela, sem o envelope. Reutilizado na comparação. */
  private async calcularBloco(filtro: FiltroMetricas, agora: Date) {
    const [total, abertosPorSev, remediados, risco, agingBruto, owasp, tempos] = await Promise.all([
      this.repository.contarTotal(filtro),
      this.repository.contarAbertosPorSeveridade(filtro),
      this.repository.contarRemediados(filtro),
      this.repository.somarRiskScore(filtro),
      this.repository.contarAgingDeAbertos(filtro, agora),
      this.repository.contarPorCategoriaOwasp(filtro),
      this.repository.listarTemposDeRemediacao(filtro),
    ]);

    const abertosPorSeveridade = preencherSeveridades(abertosPorSev);
    const totalAbertos = Object.values(abertosPorSeveridade).reduce((a, b) => a + b, 0);

    return {
      totalFindings: total,
      abertosPorSeveridade,
      totalAbertos,
      totalRemediados: remediados,
      taxaRemediacao: total > 0 ? Math.round((remediados / total) * 1000) / 10 : 0,
      riskScore: risco,
      mttrPorSeveridade: this.mttrPorSeveridade(tempos),
      aging: {
        ate7Dias: agingBruto.ate7Dias ?? 0,
        de7A30Dias: agingBruto.de7A30Dias ?? 0,
        de30A90Dias: agingBruto.de30A90Dias ?? 0,
        mais90Dias: agingBruto.mais90Dias ?? 0,
      } satisfies AgingDTO,
      porCategoriaOwasp: Object.fromEntries(owasp.map((o) => [o.chave, o.total])),
    };
  }

  /**
   * MTTR por severidade — MEDIANA, não média.
   *
   * A média é destruída por um único outlier: um finding esquecido por 400
   * dias entre nove corrigidos em 2 dias dá média de 42 dias, que não descreve
   * NENHUM caso real. A mediana devolve 2, que é o comportamento típico do
   * time. O outlier não some do sistema — ele aparece no aging, que é
   * exatamente a métrica feita para encontrá-lo.
   */
  private mttrPorSeveridade(tempos: { severidade: string; dias: number }[]): Record<string, MttrDTO> {
    const saida: Record<string, MttrDTO> = {};
    for (const severidade of SEVERIDADES) {
      const amostras = tempos.filter((t) => t.severidade === severidade).map((t) => t.dias);
      saida[severidade] = { medianaDias: mediana(amostras), amostras: amostras.length };
    }
    return saida;
  }

  /* ======================================================================
     Timeseries
     ====================================================================== */

  async getTimeseries(
    actor: Actor,
    applicationId: string,
    opcoes: OpcoesPeriodo,
    granularidadePedida: Granularidade | undefined,
    agora: Date = new Date(),
  ): Promise<MetricsTimeseriesDTO> {
    await this.assertPodeVerAplicacao(actor, applicationId);
    const { de, ate } = await this.resolverPeriodo(applicationId, opcoes, agora);
    const granularidade = granularidadePedida ?? this.granularidadeAutomatica(de, ate);
    // ⚠️ O spread vem ANTES de `de`/`ate`, e a ordem não é estética.
    // `opcoes` carrega `de`/`ate` possivelmente `undefined` (quando a query
    // string não os traz), e com o spread por último eles sobrescreveriam as
    // datas já resolvidas. O Prisma ignora `undefined` num `where` e o bug
    // passaria despercebido nas contagens — mas em SQL cru `createdAt >= NULL`
    // não casa NADA, e as agregações de risco e aging zeravam em silêncio.
    const filtro: FiltroMetricas = { ...opcoes, applicationId, de, ate };

    const [criados, resolvidos] = await Promise.all([
      this.repository.serieDeCriados(filtro, granularidade),
      this.repository.serieDeResolvidos(filtro, granularidade),
    ]);

    // O eixo é construído a partir do PERÍODO, não dos dados: um intervalo sem
    // nenhum finding tem que aparecer como zero, não sumir. Uma série que pula
    // as semanas vazias desenha uma linha que mente sobre a inclinação.
    const rotulos = gerarRotulos(de, ate, granularidade);

    const criadosPorPeriodo = new Map<string, ContagemPorChave>();
    for (const l of criados) {
      const atual = criadosPorPeriodo.get(l.periodo) ?? {};
      atual[l.chave] = (atual[l.chave] ?? 0) + l.total;
      criadosPorPeriodo.set(l.periodo, atual);
    }
    const resolvidosPorPeriodo = new Map(resolvidos.map((l) => [l.periodo, l.total]));

    // Burndown: abertos ACUMULADOS. Cada período soma o que nasceu e subtrai o
    // que foi resolvido. É a única linha do conjunto que responde "a postura
    // está melhorando ou piorando?" — as barras de criados/resolvidos sozinhas
    // não respondem, porque um período pode ter muito dos dois.
    let acumulado = 0;
    const pontos: PontoDaSerie[] = rotulos.map((rotulo) => {
      const porSeveridade = preencherSeveridades(
        Object.entries(criadosPorPeriodo.get(rotulo) ?? {}).map(([chave, total]) => ({ chave, total })),
      );
      const totalCriados = Object.values(porSeveridade).reduce((a, b) => a + b, 0);
      const totalResolvidos = resolvidosPorPeriodo.get(rotulo) ?? 0;
      acumulado = Math.max(0, acumulado + totalCriados - totalResolvidos);

      return {
        periodo: rotulo,
        criados: totalCriados,
        criadosPorSeveridade: porSeveridade,
        resolvidos: totalResolvidos,
        abertosAcumulados: acumulado,
        // Risk score do período: estimado a partir do acumulado e do CVSS
        // médio implícito da distribuição de severidade. Ver ADR-025 para o
        // porquê de não ser o mesmo cálculo do summary.
        riskScore: estimarRiscoDoPeriodo(porSeveridade, acumulado),
      };
    });

    return {
      applicationId,
      periodo: { de: de.toISOString(), ate: ate.toISOString() },
      granularidade,
      pontos,
    };
  }

  /* ======================================================================
     Insights — determinísticos, sem IA (ADR-017)
     ====================================================================== */

  /**
   * Cada insight é uma REGRA, não um modelo. A entrada é um número agregado; a
   * saída é uma frase e um filtro que reproduz o recorte. A ordem final é por
   * severidade: crítico primeiro, positivo por último — quem abre a aba lê de
   * cima para baixo e precisa achar o problema antes do elogio.
   */
  async getInsights(
    actor: Actor,
    applicationId: string,
    opcoes: OpcoesPeriodo,
    agora: Date = new Date(),
  ): Promise<MetricsInsightsDTO> {
    await this.assertPodeVerAplicacao(actor, applicationId);
    const { de, ate } = await this.resolverPeriodo(applicationId, opcoes, agora);
    // ⚠️ O spread vem ANTES de `de`/`ate`, e a ordem não é estética.
    // `opcoes` carrega `de`/`ate` possivelmente `undefined` (quando a query
    // string não os traz), e com o spread por último eles sobrescreveriam as
    // datas já resolvidas. O Prisma ignora `undefined` num `where` e o bug
    // passaria despercebido nas contagens — mas em SQL cru `createdAt >= NULL`
    // não casa NADA, e as agregações de risco e aging zeravam em silêncio.
    const filtro: FiltroMetricas = { ...opcoes, applicationId, de, ate };

    const [bloco, criticosAntigos, reaberturas, diasSemCritico] = await Promise.all([
      this.calcularBloco(filtro, agora),
      this.repository.contarCriticosAntigos(applicationId, 30, agora),
      this.repository.contarReaberturas(filtro),
      this.repository.diasSemCriticoNovo(applicationId, agora),
    ]);

    const insights: InsightDTO[] = [];

    // --- crítico antigo: a dívida mais cara -------------------------------
    if (criticosAntigos > 0) {
      insights.push({
        id: "criticos-antigos",
        severidade: "critico",
        texto: `${criticosAntigos} finding${criticosAntigos > 1 ? "s" : ""} crítico${
          criticosAntigos > 1 ? "s" : ""
        } aberto${criticosAntigos > 1 ? "s" : ""} há mais de 30 dias.`,
        filtro: { severity: "CRITICAL", status: "OPEN", agingMinDias: 30 },
      });
    }

    // --- concentração OWASP -----------------------------------------------
    const owaspOrdenado = Object.entries(bloco.porCategoriaOwasp).sort((a, b) => b[1] - a[1]);
    if (owaspOrdenado.length > 0 && bloco.totalFindings > 0) {
      const [categoria, quantidade] = owaspOrdenado[0];
      const percentual = Math.round((quantidade / bloco.totalFindings) * 100);
      // Só vira insight se houver CONCENTRAÇÃO de verdade. Com 5 categorias
      // equilibradas, "a mais frequente tem 22%" não informa nada.
      if (percentual >= 30) {
        insights.push({
          id: "owasp-concentrado",
          severidade: "atencao",
          texto: `Categoria OWASP mais frequente: ${NOME_OWASP[categoria] ?? categoria}, ${percentual}% dos findings.`,
          filtro: { owasp: categoria },
        });
      }
    }

    // --- reabertura: o sinal de correção incompleta ------------------------
    if (reaberturas > 0 && bloco.totalFindings > 0) {
      const taxa = Math.round((reaberturas / bloco.totalFindings) * 100);
      insights.push({
        id: "reabertura",
        severidade: taxa >= 10 ? "critico" : "atencao",
        texto:
          reaberturas > 1
            ? `Taxa de reabertura de ${taxa}%: ${reaberturas} findings marcados como corrigidos voltaram a OPEN.`
            : `Taxa de reabertura de ${taxa}%: 1 finding marcado como corrigido voltou a OPEN.`,
        filtro: { status: "OPEN" },
      });
    }

    // --- dívida antiga em geral -------------------------------------------
    if (bloco.aging.mais90Dias > 0) {
      insights.push({
        id: "divida-antiga",
        severidade: "atencao",
        texto: `${bloco.aging.mais90Dias} finding${bloco.aging.mais90Dias > 1 ? "s" : ""} aberto${
          bloco.aging.mais90Dias > 1 ? "s" : ""
        } há mais de 90 dias.`,
        filtro: { status: "OPEN", agingMinDias: 90 },
      });
    }

    // --- severidade dominante entre os abertos -----------------------------
    // Só vira insight quando há CONCENTRAÇÃO (≥40%). Numa distribuição
    // equilibrada, dizer "a mais comum é média" não muda decisão nenhuma.
    const abertosOrdenados = Object.entries(bloco.abertosPorSeveridade)
      .filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1]);
    if (abertosOrdenados.length > 0 && bloco.totalAbertos >= 5) {
      const [severidade, quantidade] = abertosOrdenados[0];
      const percentual = Math.round((quantidade / bloco.totalAbertos) * 100);
      if (percentual >= 40 && severidade !== "CRITICAL") {
        insights.push({
          id: "severidade-dominante",
          severidade: severidade === "HIGH" ? "atencao" : "neutro",
          texto: `${percentual}% dos findings abertos são ${ROTULO_SEVERIDADE[severidade] ?? severidade.toLowerCase()} (${quantidade} de ${bloco.totalAbertos}).`,
          filtro: { severity: severidade, status: "OPEN" },
        });
      }
    }

    // --- MTTR de HIGH: a severidade em que o tempo mais importa ------------
    const mttrHigh = bloco.mttrPorSeveridade.HIGH;
    if (mttrHigh?.medianaDias != null && mttrHigh.amostras >= 3) {
      insights.push({
        id: "mttr-high",
        severidade: mttrHigh.medianaDias > 30 ? "atencao" : "neutro",
        texto: `Tempo mediano de remediação de findings altos: ${mttrHigh.medianaDias} dias (${mttrHigh.amostras} remediações).`,
        filtro: { severity: "HIGH" },
      });
    }

    // --- positivo: postura estável ----------------------------------------
    const criticosAbertos = bloco.abertosPorSeveridade.CRITICAL ?? 0;
    if (criticosAbertos === 0) {
      const complemento = diasSemCritico != null ? ` Nenhum crítico novo há ${diasSemCritico} dias.` : "";
      insights.push({
        id: "sem-criticos",
        severidade: "positivo",
        texto: `Nenhum finding crítico em aberto.${complemento}`,
      });
    }

    if (bloco.taxaRemediacao >= 80 && bloco.totalFindings >= 5) {
      insights.push({
        id: "boa-remediacao",
        severidade: "positivo",
        texto: `Taxa de remediação de ${bloco.taxaRemediacao}% no período.`,
      });
    }

    // Vazio é um resultado legítimo, e o frontend precisa saber disso para
    // desenhar o estado vazio em vez de uma lista em branco.
    if (insights.length === 0) {
      insights.push({
        id: "sem-dados",
        severidade: "neutro",
        texto: "Ainda não há dados suficientes no período para gerar insights.",
      });
    }

    const ordem: Record<string, number> = { critico: 0, atencao: 1, neutro: 2, positivo: 3 };
    insights.sort((a, b) => ordem[a.severidade] - ordem[b.severidade]);

    return { applicationId, geradoEm: agora.toISOString(), insights };
  }

  /* ======================================================================
     Comparativo
     ====================================================================== */

  async getComparison(actor: Actor, opcoes: OpcoesPeriodo, agora: Date = new Date()): Promise<MetricsComparisonDTO> {
    // O comparativo é sempre da company do ATOR — o escopo do endpoint é
    // `/companies/me`. Um usuário sem company (ADMIN da plataforma, por
    // exemplo) não tem o que comparar.
    const user = await this.userRepository.findById(actor.userId);
    const companyId = user?.companyId;
    if (!companyId) throw new Error("COMPANY_NOT_FOUND");

    const ate = opcoes.ate ?? agora;
    const de = opcoes.de ?? new Date(ate.getTime() - 90 * DIA_MS);

    const [linhas, mttrs] = await Promise.all([
      this.repository.compararAplicacoesDaCompany(companyId, de, ate),
      this.repository.mttrPorAplicacaoDaCompany(companyId, de, ate),
    ]);
    const mttrPorApp = new Map(mttrs.map((m) => [m.applicationId, m.dias]));

    const aplicacoes: LinhaComparativoDTO[] = linhas.map((l) => {
      const total = Number(l.total);
      const remediados = Number(l.remediados);
      const mttr = mttrPorApp.get(l.applicationId);
      return {
        applicationId: l.applicationId,
        applicationName: l.applicationName,
        riskScore: Math.round(Number(l.risco ?? 0) * 100) / 100,
        taxaRemediacao: total > 0 ? Math.round((remediados / total) * 1000) / 10 : 0,
        criticosAbertos: Number(l.criticosAbertos),
        totalFindings: total,
        totalAbertos: Number(l.abertos),
        mttrGeralDias: mttr != null ? Math.round(mttr * 10) / 10 : null,
      };
    });

    return { companyId, periodo: { de: de.toISOString(), ate: ate.toISOString() }, aplicacoes };
  }
}

/* ==========================================================================
   Funções puras de apoio
   ========================================================================== */

/** Preenche com 0 as severidades que não vieram do banco. */
function preencherSeveridades(linhas: { chave: string; total: number }[]): ContagemPorChave {
  const saida: ContagemPorChave = {};
  for (const s of SEVERIDADES) saida[s] = 0;
  for (const l of linhas) saida[l.chave] = (saida[l.chave] ?? 0) + l.total;
  return saida;
}

/** Mediana de uma lista. `null` para lista vazia. */
function mediana(valores: number[]): number | null {
  if (valores.length === 0) return null;
  const ordenados = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);
  const valor = ordenados.length % 2 === 0 ? (ordenados[meio - 1] + ordenados[meio]) / 2 : ordenados[meio];
  return Math.round(valor * 10) / 10;
}

function delta(atual: number, anterior: number): DeltaDTO {
  const variacao = Math.round((atual - anterior) * 100) / 100;
  // Percentual sobre zero é infinito, não 100%. `null` é o valor honesto, e o
  // frontend mostra "—" em vez de uma seta que não significa nada.
  const variacaoPercentual = anterior === 0 ? null : Math.round(((atual - anterior) / anterior) * 1000) / 10;
  return { atual, anterior, variacao, variacaoPercentual };
}

/**
 * Risco estimado de um ponto da série.
 *
 * ⚠️ NÃO é o mesmo cálculo do summary, e a diferença é honesta: o summary soma
 * o CVSS real de cada finding aberto AGORA; a série precisaria reconstruir,
 * para cada período passado, quais findings estavam abertos e com que CVSS —
 * o que exigiria uma tabela de snapshot que o schema não tem.
 *
 * A aproximação usa o CVSS TÍPICO de cada faixa de severidade (o ponto médio
 * da faixa definida no schema.prisma) aplicado ao acumulado do período. Serve
 * para ver TENDÊNCIA, que é o que a linha existe para mostrar; não serve para
 * ler o valor absoluto de um ponto isolado. Registrado no ADR-025.
 */
function estimarRiscoDoPeriodo(porSeveridade: ContagemPorChave, acumulado: number): number {
  const CVSS_TIPICO: Record<string, number> = {
    CRITICAL: 9.5, // faixa 9.0–10.0
    HIGH: 8.0, // faixa 7.0–8.9
    MEDIUM: 5.5, // faixa 4.0–6.9
    LOW: 2.0, // faixa 0.1–3.9
    NONE: 0,
  };
  const totalCriados = Object.values(porSeveridade).reduce((a, b) => a + b, 0);
  if (totalCriados === 0) return acumulado > 0 ? calcularRiskScore(Array(acumulado).fill(5.5)) : 0;

  // CVSS médio ponderado da distribuição que chegou neste período, projetado
  // sobre o acumulado.
  const somaPonderada = Object.entries(porSeveridade).reduce((acc, [sev, n]) => acc + (CVSS_TIPICO[sev] ?? 0) * n, 0);
  const cvssMedio = somaPonderada / totalCriados;
  return calcularRiskScore(Array(acumulado).fill(cvssMedio));
}

/**
 * Rótulos de TODOS os períodos da janela, inclusive os vazios.
 * Em UTC — ver o aviso de fuso no repository.
 */
function gerarRotulos(de: Date, ate: Date, g: Granularidade): string[] {
  const rotulos: string[] = [];
  const cursor = new Date(Date.UTC(de.getUTCFullYear(), de.getUTCMonth(), de.getUTCDate()));

  if (g === "week") {
    // Alinha à segunda-feira (semana ISO), igual ao `WEEKDAY()` do MySQL.
    const diaDaSemana = (cursor.getUTCDay() + 6) % 7;
    cursor.setUTCDate(cursor.getUTCDate() - diaDaSemana);
  } else if (g === "month") {
    cursor.setUTCDate(1);
  }

  // Teto de segurança: uma janela absurda (10 anos em granularidade diária)
  // geraria milhares de pontos e travaria o gráfico antes de chegar ao browser.
  const MAX_PONTOS = 400;
  while (cursor <= ate && rotulos.length < MAX_PONTOS) {
    rotulos.push(cursor.toISOString().slice(0, 10));
    if (g === "day") cursor.setUTCDate(cursor.getUTCDate() + 1);
    else if (g === "week") cursor.setUTCDate(cursor.getUTCDate() + 7);
    else cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return rotulos;
}
