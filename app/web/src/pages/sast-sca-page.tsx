/**
 * sast-sca-page.tsx
 *
 * Página "SAST/SCA" do menu (ADR-052): todas as importações de relatórios de
 * código dos projetos que a pessoa enxerga, com o botão de importar.
 * Visível só para PENTESTER/ADMIN (rota em App.tsx + item do Sidebar); a API
 * também recusa CLIENT e filtra por membro de projeto.
 *
 * Os números do topo resumem a ÚLTIMA importação de cada par
 * projeto+ferramenta — somar todas as importações contaria o mesmo achado
 * uma vez por reimportação.
 */

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileCode2, PackageSearch, ShieldAlert, TrendingDown } from "lucide-react";
import { codeImportsApi } from "../lib/api/code-imports.api";
import { Breadcrumb } from "../components/ui/navigation";
import { Button } from "../components/ui/button";
import { EmptyState, ErrorState } from "../components/ui/empty-state";
import { Skeleton } from "../components/ui/card";
import { CodeImportDialog } from "../components/code-imports/code-import-dialog";
import { CodeImportsTable } from "../components/code-imports/code-imports-table";
import { SeverityStrip } from "../components/code-imports/severity-strip";
import { ultimasPorFonte } from "../lib/code-import";
import type { CodeSeverity } from "../types/code-import.types";

function Kpi({ icone, rotulo, valor, dica }: { icone: React.ReactNode; rotulo: string; valor: string; dica: string }) {
  return (
    <div data-ops-lift className="flex flex-col gap-2 rounded-container border border-subtle bg-surface p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.1em] text-fg-muted">
        {icone}
        {rotulo}
      </div>
      <span className="font-mono text-2xl font-bold text-fg" data-numeric>
        {valor}
      </span>
      <span className="text-xs text-fg-muted">{dica}</span>
    </div>
  );
}

export function SastScaPage() {
  const [importando, setImportando] = useState(false);
  const importsQuery = useQuery({ queryKey: ["code-imports", "all"], queryFn: () => codeImportsApi.list() });
  const imports = useMemo(() => importsQuery.data ?? [], [importsQuery.data]);

  const resumo = useMemo(() => {
    const ultimas = ultimasPorFonte(imports);
    const counts: Record<CodeSeverity, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 };
    for (const i of ultimas) for (const s of Object.keys(counts) as CodeSeverity[]) counts[s] += i.severityCounts[s] ?? 0;
    return {
      fontes: ultimas.length,
      abertos: ultimas.reduce((acc, i) => acc + i.totalFindings, 0),
      graves: counts.CRITICAL + counts.HIGH,
      resolvidos: ultimas.reduce((acc, i) => acc + i.resolvedFindings, 0),
      sbom: ultimas.filter((i) => i.format === "CYCLONEDX").reduce((acc, i) => acc + (i.componentsCount ?? 0), 0),
      counts,
    };
  }, [imports]);

  return (
    <div>
      <Breadcrumb itens={[{ rotulo: "SAST/SCA" }]} />

      <div data-ops-hero="code" className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="mb-2 font-mono text-xs uppercase tracking-[0.14em] text-accent-ink">Análise de código</p>
          <h1 className="text-2xl font-bold text-fg">SAST/SCA</h1>
          <p className="mt-1 max-w-2xl text-fg-muted">
            Importe os relatórios que a pipeline já gera — SARIF do Semgrep, CodeQL ou Trivy e SBOM CycloneDX — e trie,
            compare e promova os achados para o fluxo de remediação.
          </p>
        </div>
        <Button onClick={() => setImportando(true)}>Importar relatório</Button>
      </div>

      {importsQuery.isLoading && (
        <div className="mt-6 flex flex-col gap-2" aria-busy="true">
          <span className="sr-only">Carregando importações</span>
          <Skeleton className="h-24 w-full bg-inset" />
          <Skeleton className="h-12 w-full bg-inset" />
          <Skeleton className="h-12 w-full bg-inset" />
        </div>
      )}

      {importsQuery.isError && (
        <ErrorState
          className="mt-6"
          titulo="Não foi possível carregar as importações"
          descricao="A API não respondeu. Tente novamente em instantes."
          aoTentarNovamente={() => importsQuery.refetch()}
        />
      )}

      {importsQuery.isSuccess && imports.length === 0 && (
        <EmptyState
          className="mt-6"
          icone={<FileCode2 size={28} strokeWidth={1.5} aria-hidden="true" />}
          titulo="Nenhum relatório importado ainda"
          descricao="Rode Semgrep, CodeQL ou Trivy no repositório da aplicação e importe o SARIF ou o SBOM CycloneDX. Cada nova importação é comparada com a anterior da mesma ferramenta."
          acao={<Button onClick={() => setImportando(true)}>Importar relatório</Button>}
        />
      )}

      {importsQuery.isSuccess && imports.length > 0 && (
        <>
          <section aria-label="Resumo das importações mais recentes" className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi
              icone={<FileCode2 size={14} aria-hidden="true" />}
              rotulo="Achados atuais"
              valor={String(resumo.abertos)}
              dica={`na última importação de ${resumo.fontes} ${resumo.fontes === 1 ? "fonte" : "fontes"}`}
            />
            <Kpi icone={<ShieldAlert size={14} aria-hidden="true" />} rotulo="Críticos + altos" valor={String(resumo.graves)} dica="prioridade de triagem" />
            <Kpi icone={<TrendingDown size={14} aria-hidden="true" />} rotulo="Resolvidos" valor={String(resumo.resolvidos)} dica="sumiram desde a importação anterior" />
            <Kpi icone={<PackageSearch size={14} aria-hidden="true" />} rotulo="Componentes (SBOM)" valor={String(resumo.sbom)} dica="declarados nos SBOMs CycloneDX" />
          </section>

          <section aria-label="Distribuição por severidade" className="mt-4 rounded-container border border-subtle bg-surface p-4">
            <SeverityStrip counts={resumo.counts} legenda />
          </section>

          <h2 className="mb-3 mt-8 text-lg font-semibold text-fg">Importações</h2>
          <CodeImportsTable imports={imports} />
        </>
      )}

      <CodeImportDialog aberto={importando} aoFechar={() => setImportando(false)} />
    </div>
  );
}
