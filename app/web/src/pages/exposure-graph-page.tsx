/**
 * exposure-graph-page.tsx
 *
 * O QUE FAZ
 * Página do Exposure Graph da empresa (CP-8): duas visões dos mesmos dados,
 * o grafo 2D (empresa → aplicações → categorias OWASP abertas, com os layouts
 * do CyberGraph) e o mapa 3D da superfície de ataque, com seleção e painel
 * compartilhados. No 3D, "Apresentar" percorre as aplicações da mais grave
 * para a menos grave (desligado com movimento reduzido).
 *
 * No grafo, as análises do ADR-061 (combinações tóxicas, raio de impacto,
 * máquina do tempo — `analises/use-analises-do-grafo.tsx`) e os comentários
 * por nó. `?no=<id>` (link da notificação de comentário) já abre com o nó
 * selecionado.
 *
 * POR QUE EXISTE
 * O CyberGraph mostra um scan; esta página mostra a empresa. Nome oficial:
 * Exposure Graph / Cadeias de Exposição — nunca "Attack Path" (DECISIONS D8).
 *
 * QUEM USA
 * `App.tsx` (rota `/exposure-graph`, ADMIN e CLIENT) e o item da Sidebar.
 */

import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Pause, Play } from "lucide-react";
import { exposureGraphApi } from "../lib/api/exposure-graph.api";
import { getResourceFailure } from "../lib/resource-failure";
import { ResourceLoadError, ResourceUnavailable } from "../components/ui/resource-unavailable";
import { companiesApi } from "../lib/api/companies.api";
import { getApiErrorCode } from "../hooks/use-api-error";
import { Breadcrumb } from "../components/ui/navigation";
import { Skeleton } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Tabs } from "../components/ui/tabs";
import { EmptyState } from "../components/ui/empty-state";
import { useMotion } from "../motion/use-motion";
import { idDaAplicacao } from "../features/security-graph/exposure-graph-model";
import { PainelExposicao } from "../features/security-graph/painel-exposicao";
import { chaveDosComentarios, contarPorNo } from "../features/security-graph/comentarios";
import { useAnalisesDoGrafo } from "../features/security-graph/analises/use-analises-do-grafo";
import { graphCommentsApi } from "../lib/api/graph-comments.api";
import { ExposureGraph2D } from "../features/security-graph/exposure-graph";
import type { ExposureGraph } from "../types/exposure-graph.types";
import { riscoDoExposureGraph } from "../features/atmosfera-3d/risco";
import { pingarAtmosfera, usePublicarRisco, useSuprimirAtmosfera } from "../features/atmosfera-3d/atmosfera.store";

// A página já é lazy (paginaLazy); o mapa é outro chunk para `three` só baixar na aba do mapa.
const ExposureMap3D = lazy(
  () => import("../features/security-graph/exposure-map-3d"),
);
const ORDEM: Record<string, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};
const PASSO_APRESENTACAO_MS = 4000;

function MapaComApresentacao({
  dados,
  selecionadoId,
  aoSelecionar,
}: {
  dados: ExposureGraph;
  selecionadoId: string | null;
  aoSelecionar(id: string | null): void;
}) {
  const { reduzido } = useMotion();
  const [apresentando, setApresentando] = useState(false);
  const roteiro = useMemo(
    () =>
      [...dados.aplicacoes]
        .filter((a) => a.totalAbertas > 0)
        .sort(
          (a, b) =>
            (ORDEM[a.piorSeveridade ?? ""] ?? 4) -
              (ORDEM[b.piorSeveridade ?? ""] ?? 4) ||
            b.totalAbertas - a.totalAbertas,
        )
        .map((a) => idDaAplicacao(a.id)),
    [dados.aplicacoes],
  );
  useEffect(() => {
    if (!apresentando || !roteiro.length) return;
    let i = 0;
    aoSelecionar(roteiro[0]);
    const timer = window.setInterval(() => {
      i = (i + 1) % roteiro.length;
      aoSelecionar(roteiro[i]);
    }, PASSO_APRESENTACAO_MS);
    return () => window.clearInterval(timer);
  }, [apresentando, roteiro, aoSelecionar]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-fg-muted">
          Cada prédio é uma aplicação ativa. Clique para ver o contexto; arraste
          para girar e role para aproximar.
        </p>
        <Button
          variant="secundario"
          size="sm"
          disabled={reduzido || !roteiro.length}
          title={
            reduzido
              ? "Desligado com movimento reduzido"
              : "Percorre as aplicações da mais grave para a menos grave"
          }
          onClick={() => setApresentando((v) => !v)}
          aria-pressed={apresentando}
          iconeInicio={
            apresentando ? (
              <Pause className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Play className="h-4 w-4" aria-hidden="true" />
            )
          }
        >
          {apresentando ? "Parar apresentação" : "Apresentar"}
        </Button>
      </div>
      <Suspense fallback={<Skeleton className="h-[34rem] w-full bg-inset" />}>
        <ExposureMap3D
          dados={dados}
          selecionadoId={selecionadoId}
          aoSelecionar={(id) => {
            // Clique da pessoa encerra a apresentação: ela assumiu o controle.
            setApresentando(false);
            aoSelecionar(id);
          }}
        />
      </Suspense>
    </div>
  );
}

export function ExposureGraphPage() {
  const consulta = useQuery({
    queryKey: ["exposure-graph"],
    queryFn: exposureGraphApi.obter,
  });
  const empresa = useQuery({
    queryKey: ["companies", "me"],
    queryFn: companiesApi.me,
    enabled: consulta.isSuccess && Boolean(consulta.data),
    retry: false,
  });
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const failure = getResourceFailure(consulta.error);
  const semEmpresa = failure === "unavailable" && getApiErrorCode(consulta.error) === "COMPANY_NOT_FOUND";
  // A atmosfera (relevo) acompanha o grafo: sobe com as abertas, pinga a cada
  // seleção e some na aba do mapa 3D, que tem a própria cena (D21.2).
  const [params] = useSearchParams();
  useSuprimirAtmosfera(params.get("visao") === "mapa");
  usePublicarRisco(consulta.data ? riscoDoExposureGraph(consulta.data.aplicacoes) : undefined);
  const selecionar = useCallback((id: string | null) => {
    setSelecionadoId(id);
    if (id) pingarAtmosfera();
  }, []);

  const temDados = !!consulta.data && consulta.data.aplicacoes.length > 0;
  const analises = useAnalisesDoGrafo(consulta.data, selecionar);
  const comentarios = useQuery({
    queryKey: chaveDosComentarios("EXPOSURE"),
    queryFn: () => graphCommentsApi.listar("EXPOSURE"),
    enabled: temDados,
  });
  const comentariosPorNo = useMemo(() => contarPorNo(comentarios.data), [comentarios.data]);

  // Link da notificação de comentário: abre com o nó selecionado.
  const noDaUrl = params.get("no");
  useEffect(() => {
    if (noDaUrl && temDados) setSelecionadoId(noDaUrl);
  }, [noDaUrl, temDados]);

  if (!semEmpresa) {
    if (failure === "unavailable") {
      return <ResourceUnavailable backTo="/applications" backLabel="Voltar para aplicações" />;
    }
    if (failure) return <ResourceLoadError failure={failure} onRetry={() => void consulta.refetch()} />;
  }

  return (
    <div className="space-y-6">
      <Breadcrumb
        itens={[
          { rotulo: "Início", para: "/dashboard" },
          { rotulo: "Exposure Graph" },
        ]}
      />

      <header data-ops-hero="application" className="space-y-1">
        <p className="font-mono text-xs uppercase tracking-[0.14em] text-accent-ink">
          Visão da empresa
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-fg">
          Exposure Graph
        </h1>
        <p className="text-sm text-fg-secondary">
          Onde estão as vulnerabilidades abertas da empresa e o que elas têm em
          comum: aplicações, ambientes, exposição à Internet e as categorias
          OWASP que se repetem.
        </p>
      </header>

      {consulta.isLoading ? (
        <Skeleton className="h-[34rem] w-full" />
      ) : semEmpresa ? (
        <EmptyState
          titulo="Sua conta não está vinculada a uma empresa"
          descricao="O Exposure Graph mostra as aplicações da empresa de quem está logado."
        />
      ) : !consulta.data ? (
        <ResourceUnavailable backTo="/applications" backLabel="Voltar para aplicações" />
      ) : consulta.data.aplicacoes.length === 0 ? (
        <EmptyState
          titulo="Nenhuma aplicação ativa"
          descricao="Cadastre uma aplicação para ver a superfície de ataque da empresa."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
          {/* min-w-0: sem ele o grafo (largo) estica a coluna e a página rola de lado no celular. */}
          <div className="min-w-0">
            <Tabs
              paramUrl="visao"
              abas={[
                {
                  id: "grafo",
                  rotulo: "Grafo",
                  conteudo: (
                    <ExposureGraph2D
                      dados={analises.dadosExibidos ?? consulta.data}
                      nomeEmpresa={empresa.data?.name ?? "Empresa"}
                      selecionadoId={selecionadoId}
                      aoSelecionar={selecionar}
                      barraDeAnalise={analises.barra}
                      destaque={analises.destaque}
                      comentarios={comentariosPorNo}
                    />
                  ),
                },
                {
                  id: "mapa",
                  rotulo: "Mapa 3D",
                  conteudo: (
                    <MapaComApresentacao
                      dados={consulta.data}
                      selecionadoId={selecionadoId}
                      aoSelecionar={selecionar}
                    />
                  ),
                },
              ]}
            />
          </div>
          {/* No mapa 3D a análise não se aplica: volta o painel da seleção. */}
          {(params.get("visao") !== "mapa" && analises.painel) || (
            <PainelExposicao
              dados={consulta.data}
              selecionadoId={selecionadoId}
              aoSelecionar={selecionar}
              comentarios={comentarios.data}
            />
          )}
        </div>
      )}
    </div>
  );
}
