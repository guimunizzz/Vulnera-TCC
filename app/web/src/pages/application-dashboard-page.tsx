/**
 * application-dashboard-page.tsx
 *
 * O QUE FAZ
 * O painel analítico de UMA aplicação, em quatro visões: Postura atual,
 * Evolução, Insights e Comparativo.
 *
 * POR QUE AS QUATRO SÃO PADRONIZADAS
 * Toda aplicação tem exatamente as mesmas abas, com os mesmos gráficos nas
 * mesmas posições. É o que permite comparar duas aplicações de relance — um
 * painel que se adapta ao conteúdo obriga a reaprender o layout a cada troca.
 *
 * ESTADO
 * Filtros e aba ativa vivem na URL (`use-filtros-metricas.ts` e a prop
 * `paramUrl` das `Tabs`). Consequência prática: o link é compartilhável com o
 * recorte inteiro, e o "voltar" do navegador desfaz.
 *
 * BUSCA DE DADOS
 * Uma query do TanStack Query por endpoint, com a chave incluindo o filtro
 * serializado — mudou o filtro, muda a chave, refetch. `placeholderData`
 * mantém o dado anterior visível enquanto o novo chega, o que evita o painel
 * piscar para esqueleto a cada tecla da busca.
 *
 * QUEM USA
 * Rota `/applications/:id/dashboard`.
 */

import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { applicationsApi } from "../lib/api/applications.api";
import { metricsApi, montarQuery } from "../lib/api/metrics.api";
import { useFiltrosMetricas } from "../hooks/use-filtros-metricas";
import {
  Breadcrumb,
  Card,
  EmptyState,
  ErrorState,
  LinkButton,
  Progress,
  ROTULO_SEVERIDADE,
  SeverityBadge,
  Skeleton,
  Table,
  Tabs,
  type Severidade,
} from "../components/ui";
import { FilterBar } from "../components/metrics/filter-bar";
import { KpiCard } from "../components/metrics/kpi-card";
import {
  DonutDeSeveridade,
  GraficoCriadosVersusResolvidos,
  GraficoDeAging,
  GraficoDeBurndown,
  GraficoDeRiskScore,
} from "../components/metrics/charts";
import { StaggerItem, StaggerList } from "../motion/components";
import type { Insight } from "../types/metrics.types";

export function ApplicationDashboardPage() {
  const { id = "" } = useParams();
  const controles = useFiltrosMetricas(id);
  const { paraApi, filtros, aplicarRecorte } = controles;

  // A chave inclui a query serializada: é o que faz o cache separar recortes
  // diferentes em vez de servir o de outro filtro.
  const chave = montarQuery(paraApi);

  const aplicacao = useQuery({
    queryKey: ["application", id],
    queryFn: () => applicationsApi.getById(id),
    enabled: Boolean(id),
  });

  const summary = useQuery({
    queryKey: ["metrics", "summary", id, chave],
    queryFn: () => metricsApi.summary(id, paraApi),
    enabled: Boolean(id),
    placeholderData: keepPreviousData,
  });

  const timeseries = useQuery({
    queryKey: ["metrics", "timeseries", id, chave],
    queryFn: () => metricsApi.timeseries(id, paraApi),
    enabled: Boolean(id),
    placeholderData: keepPreviousData,
  });

  const insights = useQuery({
    queryKey: ["metrics", "insights", id, chave],
    queryFn: () => metricsApi.insights(id, paraApi),
    enabled: Boolean(id),
    placeholderData: keepPreviousData,
  });

  const comparison = useQuery({
    queryKey: ["metrics", "comparison", chave],
    queryFn: () => metricsApi.comparison(paraApi),
    placeholderData: keepPreviousData,
  });

  const s = summary.data;
  // `?? []` cria um array NOVO a cada render, o que invalidaria os `useMemo`
  // abaixo em toda renderização. O memo aqui é o que os torna estáveis.
  const pontos = useMemo(() => timeseries.data?.pontos ?? [], [timeseries.data]);

  /** Série curta para as sparklines dos KPIs. */
  const serieAbertos = useMemo(() => pontos.map((p) => p.abertosAcumulados), [pontos]);
  const serieRisco = useMemo(() => pontos.map((p) => p.riskScore), [pontos]);

  const riscoMedio = useMemo(
    () => (pontos.length ? Math.round((pontos.reduce((a, p) => a + p.riskScore, 0) / pontos.length) * 10) / 10 : undefined),
    [pontos],
  );

  const carregando = summary.isLoading;
  const erro = summary.isError;

  /* ------------------------------------------------------------------ */

  if (erro && !s) {
    return (
      <div className="flex flex-col gap-6">
        <Breadcrumb itens={[{ rotulo: "Aplicações", para: "/applications" }, { rotulo: "Painel" }]} />
        <ErrorState
          titulo="Não foi possível carregar o painel"
          descricao="As métricas não responderam. O restante da aplicação continua funcionando."
          aoTentarNovamente={() => summary.refetch()}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb
        itens={[
          { rotulo: "Aplicações", para: "/applications" },
          { rotulo: aplicacao.data?.name ?? "Aplicação", para: `/applications` },
          { rotulo: "Painel" },
        ]}
      />

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-fg">{aplicacao.data?.name ?? <Skeleton className="h-7 w-48" />}</h1>
          <p className="text-sm text-fg-muted">
            Postura de segurança{" "}
            {s && (
              <>
                · {s.totalFindings} findings no período · {s.totalAbertos} em aberto
              </>
            )}
          </p>
        </div>
      </header>

      <FilterBar
        controles={controles}
        contagens={{ severidade: s?.abertosPorSeveridade, owasp: s?.porCategoriaOwasp }}
        totalNoRecorte={s?.totalFindings}
        carregando={summary.isFetching}
      />

      <Tabs
        paramUrl="aba"
        abas={[
          {
            id: "postura",
            rotulo: "Postura atual",
            conteudo: (
              <div className="flex flex-col gap-6">
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {carregando || !s ? (
                    <>
                      <EsqueletoKpi />
                      <EsqueletoKpi />
                      <EsqueletoKpi />
                      <EsqueletoKpi />
                    </>
                  ) : (
                    <>
                      <KpiCard
                        rotulo="Findings em aberto"
                        valor={s.totalAbertos}
                        delta={s.comparacao?.totalAbertos}
                        subirEhBom={false}
                        serie={serieAbertos}
                        ajuda="Findings com status OPEN ou IN_PROGRESS dentro do período e dos filtros aplicados."
                      />
                      <KpiCard
                        rotulo="Risk score"
                        valor={s.riskScore}
                        casas={1}
                        delta={s.comparacao?.riskScore}
                        subirEhBom={false}
                        serie={serieRisco}
                        ajuda="Soma de (CVSS² ÷ 10) dos findings em aberto. Um finding de CVSS 10,0 vale exatamente 10 pontos. É soma, não média: risco acumula."
                      />
                      <KpiCard
                        rotulo="Taxa de remediação"
                        valor={s.taxaRemediacao}
                        casas={1}
                        formatar={(n) => `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`}
                        delta={s.comparacao?.taxaRemediacao}
                        subirEhBom
                        ajuda="(Corrigidos + Fechados) ÷ total de findings do período."
                      />
                      <KpiCard
                        rotulo="Críticos em aberto"
                        valor={s.abertosPorSeveridade.CRITICAL ?? 0}
                        subirEhBom={false}
                        alerta={(s.abertosPorSeveridade.CRITICAL ?? 0) > 0}
                        ajuda="Findings de severidade CRITICAL ainda não remediados."
                      />
                    </>
                  )}
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <DonutDeSeveridade
                    porSeveridade={s?.abertosPorSeveridade ?? {}}
                    carregando={carregando}
                    erro={summary.isError}
                    aoTentarNovamente={() => summary.refetch()}
                    severidadeSelecionada={filtros.severidades[0]}
                    aoSelecionar={(sev) => aplicarRecorte({ severity: sev })}
                  />
                  <GraficoDeAging
                    aging={s?.aging ?? { ate7Dias: 0, de7A30Dias: 0, de30A90Dias: 0, mais90Dias: 0 }}
                    carregando={carregando}
                    erro={summary.isError}
                    aoTentarNovamente={() => summary.refetch()}
                    aoSelecionar={(dias) => dias > 0 && aplicarRecorte({ agingMinDias: dias })}
                  />
                </div>

                <Card titulo="Tempo mediano de remediação" descricao="Mediana por severidade — a média seria destruída por um único finding esquecido.">
                  {carregando || !s ? (
                    <Skeleton className="h-24 w-full" />
                  ) : (
                    <MttrPorSeveridade mttr={s.mttrPorSeveridade} />
                  )}
                </Card>
              </div>
            ),
          },

          {
            id: "evolucao",
            rotulo: "Evolução",
            conteudo: (
              <div className="flex flex-col gap-4">
                <GraficoDeBurndown
                  pontos={pontos}
                  carregando={timeseries.isLoading}
                  erro={timeseries.isError}
                  aoTentarNovamente={() => timeseries.refetch()}
                />
                <div className="grid gap-4 lg:grid-cols-2">
                  <GraficoCriadosVersusResolvidos
                    pontos={pontos}
                    carregando={timeseries.isLoading}
                    erro={timeseries.isError}
                    aoTentarNovamente={() => timeseries.refetch()}
                  />
                  <GraficoDeRiskScore
                    pontos={pontos}
                    referencia={riscoMedio}
                    carregando={timeseries.isLoading}
                    erro={timeseries.isError}
                    aoTentarNovamente={() => timeseries.refetch()}
                  />
                </div>
                {timeseries.data && (
                  <p className="text-xs text-fg-muted">
                    Granularidade {rotuloGranularidade(timeseries.data.granularidade)}, escolhida automaticamente pelo
                    tamanho da janela. Agregação em UTC.
                  </p>
                )}
              </div>
            ),
          },

          {
            id: "insights",
            rotulo: "Insights",
            contagem: insights.data?.insights.length,
            conteudo: (
              <ListaDeInsights
                insights={insights.data?.insights ?? []}
                carregando={insights.isLoading}
                erro={insights.isError}
                aoTentarNovamente={() => insights.refetch()}
                aoAplicar={aplicarRecorte}
              />
            ),
          },

          {
            id: "comparativo",
            rotulo: "Comparativo",
            conteudo: (
              <Comparativo
                dados={comparison.data?.aplicacoes ?? []}
                atual={id}
                carregando={comparison.isLoading}
                erro={comparison.isError}
                aoTentarNovamente={() => comparison.refetch()}
              />
            ),
          },
        ]}
      />
    </div>
  );
}

/* ==========================================================================
   Peças
   ========================================================================== */

const rotuloGranularidade = (g: string) => ({ day: "diária", week: "semanal", month: "mensal" })[g] ?? g;

function EsqueletoKpi() {
  return (
    <Card className="flex flex-col gap-3">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-9 w-20" />
      <Skeleton className="h-3 w-28" />
    </Card>
  );
}

function MttrPorSeveridade({ mttr }: { mttr: Record<string, { medianaDias: number | null; amostras: number }> }) {
  const linhas = (["CRITICAL", "HIGH", "MEDIUM", "LOW"] as Severidade[])
    .map((s) => ({ severidade: s, ...mttr[s] }))
    .filter((l) => l.amostras > 0);

  if (linhas.length === 0) {
    return (
      <EmptyState
        compacto
        titulo="Ainda sem remediações no período"
        descricao="O tempo de remediação é reconstruído da trilha de auditoria: aparece quando o primeiro finding for marcado como corrigido."
        className="border-0"
      />
    );
  }

  const maximo = Math.max(...linhas.map((l) => l.medianaDias ?? 0));

  return (
    <ul className="flex flex-col gap-3">
      {linhas.map((l) => (
        <li key={l.severidade} className="flex items-center gap-4">
          <span className="w-24 shrink-0">
            <SeverityBadge severidade={l.severidade} />
          </span>
          <div className="flex-1">
            <Progress
              valor={maximo > 0 ? ((l.medianaDias ?? 0) / maximo) * 100 : 0}
              rotulo={`Tempo mediano de remediação de findings ${ROTULO_SEVERIDADE[l.severidade].toLowerCase()}`}
              textoDoValor={`${l.medianaDias} dias, mediana de ${l.amostras} remediações`}
            />
          </div>
          <span className="w-28 shrink-0 text-right font-mono text-sm text-fg" data-numeric>
            {l.medianaDias} d
            <span className="ml-1 text-xs text-fg-muted">({l.amostras})</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

const ESTILO_INSIGHT: Record<string, { caixa: string; icone: string }> = {
  critico: { caixa: "border-severity-critical bg-severity-critical-surface", icone: "text-severity-critical-ink" },
  atencao: { caixa: "border-severity-medium bg-severity-medium-surface", icone: "text-severity-medium-ink" },
  neutro: { caixa: "border-subtle bg-surface", icone: "text-fg-muted" },
  positivo: { caixa: "border-success bg-success-surface", icone: "text-success-ink" },
};

function ListaDeInsights({
  insights,
  carregando,
  erro,
  aoTentarNovamente,
  aoAplicar,
}: {
  insights: Insight[];
  carregando: boolean;
  erro: boolean;
  aoTentarNovamente: () => void;
  aoAplicar: (filtro: Record<string, string | number>) => void;
}) {
  if (erro) return <ErrorState aoTentarNovamente={aoTentarNovamente} />;
  if (carregando) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        <span className="sr-only">Carregando insights</span>
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  return (
    <StaggerList as="ul" className="flex flex-col gap-3">
      {insights.map((i, indice) => {
        const estilo = ESTILO_INSIGHT[i.severidade] ?? ESTILO_INSIGHT.neutro;
        return (
          <StaggerItem as="li" key={i.id} indice={indice}>
            <div className={`flex items-start gap-3 rounded-container border p-4 ${estilo.caixa}`}>
              <svg viewBox="0 0 16 16" className={`mt-px h-4 w-4 shrink-0 ${estilo.icone}`} fill="currentColor" aria-hidden="true">
                {i.severidade === "positivo" ? (
                  <path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Zm3.2 4.8-4 4.5-2.4-2.2.9-1 1.5 1.4 3.1-3.5.9.8Z" />
                ) : (
                  <path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM7.25 4.5h1.5v5h-1.5v-5Zm0 6.25h1.5v1.5h-1.5v-1.5Z" />
                )}
              </svg>
              <p className="flex-1 text-sm text-fg">{i.texto}</p>
              {/* Insight com filtro vira ação: clicar aplica o recorte que o
                  gerou nas outras abas. É o que separa "relatório" de
                  "ferramenta". */}
              {i.filtro && (
                <button
                  type="button"
                  onClick={() => aoAplicar(i.filtro!)}
                  className="shrink-0 rounded-control px-2 py-1 text-xs font-medium text-accent-ink transition-colors duration-fast hover:bg-hovered"
                >
                  Ver findings
                </button>
              )}
            </div>
          </StaggerItem>
        );
      })}
    </StaggerList>
  );
}

function Comparativo({
  dados,
  atual,
  carregando,
  erro,
  aoTentarNovamente,
}: {
  dados: {
    applicationId: string;
    applicationName: string;
    riskScore: number;
    taxaRemediacao: number;
    criticosAbertos: number;
    totalFindings: number;
    totalAbertos: number;
    mttrGeralDias: number | null;
  }[];
  atual: string;
  carregando: boolean;
  erro: boolean;
  aoTentarNovamente: () => void;
}) {
  if (erro) return <ErrorState aoTentarNovamente={aoTentarNovamente} />;
  if (carregando) return <Skeleton className="h-64 w-full" />;

  return (
    <Card titulo="Aplicações da empresa" descricao="Ordenável por qualquer coluna. A linha destacada é a aplicação atual." semPadding>
      <Table
        legenda="Comparativo de postura entre as aplicações da empresa"
        chaveDaLinha={(l) => l.applicationId}
        rotuloDaLinha={(l) => l.applicationName}
        primeiraColunaFixa
        vazio={
          <EmptyState
            titulo="Nenhuma outra aplicação para comparar"
            descricao="O comparativo fica útil a partir da segunda aplicação cadastrada."
            acao={<LinkButton to="/applications" size="sm" variant="secundario">Ver aplicações</LinkButton>}
          />
        }
        colunas={[
          {
            id: "nome",
            cabecalho: "Aplicação",
            ordenarPor: (l) => l.applicationName,
            celula: (l) => (
              <span className={l.applicationId === atual ? "font-semibold text-accent-ink" : "text-fg"}>
                {l.applicationName}
                {l.applicationId === atual && <span className="sr-only"> (aplicação atual)</span>}
              </span>
            ),
          },
          {
            id: "risco",
            cabecalho: "Risk score",
            alinhamento: "direita",
            ordenarPor: (l) => l.riskScore,
            celula: (l) => l.riskScore.toLocaleString("pt-BR", { maximumFractionDigits: 1 }),
          },
          {
            id: "criticos",
            cabecalho: "Críticos abertos",
            alinhamento: "direita",
            ordenarPor: (l) => l.criticosAbertos,
            celula: (l) => (
              <span className={l.criticosAbertos > 0 ? "font-semibold text-severity-critical-ink" : "text-fg-muted"}>
                {l.criticosAbertos}
              </span>
            ),
          },
          {
            id: "remediacao",
            cabecalho: "Remediação",
            alinhamento: "direita",
            ordenarPor: (l) => l.taxaRemediacao,
            celula: (l) => `${l.taxaRemediacao.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`,
          },
          {
            id: "mttr",
            cabecalho: "MTTR",
            alinhamento: "direita",
            ocultarEmTelaEstreita: true,
            ordenarPor: (l) => l.mttrGeralDias ?? Number.MAX_SAFE_INTEGER,
            celula: (l) => (l.mttrGeralDias != null ? `${l.mttrGeralDias} d` : "—"),
          },
          {
            id: "abertos",
            cabecalho: "Abertos / total",
            alinhamento: "direita",
            ocultarEmTelaEstreita: true,
            ordenarPor: (l) => l.totalAbertos,
            celula: (l) => `${l.totalAbertos} / ${l.totalFindings}`,
          },
        ]}
        linhas={dados}
      />
    </Card>
  );
}
