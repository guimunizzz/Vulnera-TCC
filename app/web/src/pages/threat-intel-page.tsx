/**
 * threat-intel-page.tsx
 *
 * O QUE FAZ
 * A Threat Intelligence do Vulnera (ADR-053): o inventário de tecnologias da
 * empresa, as CVEs publicadas que o afetam (com KEV e EPSS), o feed geral e o
 * estado das fontes. O cabeçalho é um boletim com o estado real
 * (`boletim.tsx`); abaixo, quatro abas, com a aba, a empresa e a CVE em foco na
 * URL — é para onde o sino de notificações leva.
 *
 * QUEM USA
 * Os três papéis (rota `/threat-intel`). O CLIENT vê a própria empresa; ADMIN
 * e PENTESTER escolhem entre as que enxergam. O que cada um pode FAZER vem da
 * API (`permissoes` do resumo), não de suposição da tela.
 */

import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { threatIntelApi } from "../lib/api/threat-intel.api";
import { useApiError } from "../hooks/use-api-error";
import { Breadcrumb } from "../components/ui/navigation";
import { Skeleton } from "../components/ui/card";
import { EmptyState, ErrorState } from "../components/ui/empty-state";
import { Tabs } from "../components/ui/tabs";
import { Boletim } from "../components/threat-intel/boletim";
import { AfetaTab } from "../components/threat-intel/afeta-tab";
import { InventarioTab } from "../components/threat-intel/inventario-tab";
import { FeedTab, FontesTab } from "../components/threat-intel/feed-tab";
import { useAuthStore } from "../store/auth.store";

const CLASSE_SELECT = "h-touch rounded-control border border-default bg-surface px-3 text-sm text-fg";

export function ThreatIntelPage() {
  const getErrorMessage = useApiError();
  const [params, setParams] = useSearchParams();
  const ehCliente = useAuthStore((s) => s.user?.role) === "CLIENT";

  const empresas = useQuery({ queryKey: ["threat-intel", "companies"], queryFn: threatIntelApi.companies });
  const empresaDaUrl = params.get("empresa");
  const companyId = empresaDaUrl ?? empresas.data?.[0]?.id ?? null;
  const nomeDaEmpresa = empresas.data?.find((e) => e.id === companyId)?.name ?? null;

  // Sem empresa na URL, fixa a primeira visível (o link fica compartilhável).
  useEffect(() => {
    if (!empresaDaUrl && empresas.data?.[0]) {
      setParams(
        (p) => {
          p.set("empresa", empresas.data![0]!.id);
          return p;
        },
        { replace: true },
      );
    }
  }, [empresaDaUrl, empresas.data, setParams]);

  const resumo = useQuery({
    queryKey: ["threat-intel", "overview", companyId],
    queryFn: () => threatIntelApi.overview(companyId ?? undefined),
    enabled: !!companyId,
  });

  const seletor =
    !ehCliente && (empresas.data?.length ?? 0) > 1 ? (
      <label className="flex flex-col gap-1 text-sm font-medium text-fg-secondary">
        Empresa
        <select
          className={CLASSE_SELECT}
          value={companyId ?? ""}
          onChange={(e) =>
            setParams((p) => {
              p.set("empresa", e.target.value);
              p.delete("match");
              return p;
            })
          }
        >
          {empresas.data!.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </label>
    ) : undefined;

  if (empresas.isLoading) return <Skeleton className="h-24 w-full bg-inset" />;
  if (empresas.isError) return <ErrorState titulo="Threat Intel indisponível" descricao={getErrorMessage(empresas.error)} aoTentarNovamente={() => empresas.refetch()} />;
  if (!companyId) {
    return (
      <div className="flex flex-col gap-6">
        <Breadcrumb itens={[{ rotulo: "Threat Intel" }]} />
        <EmptyState titulo="Nenhuma empresa para acompanhar" descricao="A Threat Intel mostra as empresas dos projetos de que você participa." />
      </div>
    );
  }

  const r = resumo.data;
  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb itens={[{ rotulo: "Threat Intel" }]} />
      {resumo.isError ? (
        <ErrorState titulo="Não foi possível carregar a Threat Intel" descricao={getErrorMessage(resumo.error)} aoTentarNovamente={() => resumo.refetch()} />
      ) : (
        <>
          <Boletim resumo={r} empresa={nomeDaEmpresa} seletor={seletor} />
          {!r ? (
            <Skeleton className="h-24 w-full bg-inset" />
          ) : (
            <Tabs
              paramUrl="aba"
              abas={[
                {
                  id: "afeta",
                  rotulo: "Afeta você",
                  contagem: (r.casamentos.porTriagem.NEW ?? 0) + (r.casamentos.porTriagem.CONFIRMED ?? 0) || undefined,
                  conteudo: <AfetaTab companyId={companyId} permissoes={r.permissoes} matchInicial={params.get("match")} />,
                },
                {
                  id: "inventario",
                  rotulo: "Inventário",
                  contagem: r.inventario.sugeridos > 0 ? r.inventario.sugeridos : undefined,
                  conteudo: <InventarioTab companyId={companyId} permissoes={r.permissoes} />,
                },
                { id: "feed", rotulo: "Feed de CVEs", conteudo: <FeedTab companyId={companyId} /> },
                { id: "fontes", rotulo: "Fontes", conteudo: <FontesTab companyId={companyId} permissoes={r.permissoes} /> },
              ]}
            />
          )}
        </>
      )}
    </div>
  );
}
