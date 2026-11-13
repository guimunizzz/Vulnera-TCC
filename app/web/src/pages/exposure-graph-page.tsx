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
 * POR QUE EXISTE
 * O CyberGraph mostra um scan; esta página mostra a empresa. Nome oficial:
 * Exposure Graph / Cadeias de Exposição — nunca "Attack Path" (DECISIONS D8).
 *
 * QUEM USA
 * `App.tsx` (rota `/exposure-graph`, ADMIN e CLIENT) e o item da Sidebar.
 */

import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Pause, Play } from "lucide-react";
import { exposureGraphApi } from "../lib/api/exposure-graph.api";
import { companiesApi } from "../lib/api/companies.api";
import { getApiErrorCode, useApiError } from "../hooks/use-api-error";
import { Breadcrumb } from "../components/ui/navigation";
import { Skeleton } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Tabs } from "../components/ui/tabs";
import { EmptyState, ErrorState } from "../components/ui/empty-state";
import { useMotion } from "../motion/use-motion";
import { idDaAplicacao } from "../features/security-graph/exposure-graph-model";
import { PainelExposicao } from "../features/security-graph/painel-exposicao";
import { ExposureGraph2D } from "../features/security-graph/exposure-graph";
import type { ExposureGraph } from "../types/exposure-graph.types";

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
  const getErrorMessage = useApiError();
  const consulta = useQuery({
    queryKey: ["exposure-graph"],
    queryFn: exposureGraphApi.obter,
  });
  const empresa = useQuery({
    queryKey: ["companies", "me"],
    queryFn: companiesApi.me,
    retry: false,
  });
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const semEmpresa = getApiErrorCode(consulta.error) === "COMPANY_NOT_FOUND";

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
      ) : consulta.isError || !consulta.data ? (
        <ErrorState
          descricao={getErrorMessage(consulta.error)}
          aoTentarNovamente={() => consulta.refetch()}
        />
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
                      dados={consulta.data}
                      nomeEmpresa={empresa.data?.name ?? "Empresa"}
                      selecionadoId={selecionadoId}
                      aoSelecionar={setSelecionadoId}
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
                      aoSelecionar={setSelecionadoId}
                    />
                  ),
                },
              ]}
            />
          </div>
          <PainelExposicao
            dados={consulta.data}
            selecionadoId={selecionadoId}
            aoSelecionar={setSelecionadoId}
          />
        </div>
      )}
    </div>
  );
}
