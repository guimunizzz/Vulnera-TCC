/**
 * code-import-detail-page.tsx
 *
 * Detalhe de uma importação SAST/SCA (ADR-052): o que veio, o que mudou desde
 * a importação anterior e o que o pentester faz com cada achado (triar,
 * promover). Também gera o PDF da importação.
 *
 * DECISÕES DE UX
 *  - Filtros na própria tela (severidade, origem, triagem, busca e "só
 *    novos"): um SARIF do Semgrep num repositório real traz centenas de
 *    linhas, e a tarefa do pentester é varrer o que importa primeiro.
 *  - "Novo" é calculado pela comparação com a importação anterior (mesma
 *    ferramenta no mesmo projeto), não pela data: reimportar o mesmo relatório
 *    não pode fazer tudo parecer novo.
 *  - A linha expandida mostra as AÇÕES primeiro (triagem e promoção) e só
 *    depois o detalhe técnico — mesma ordem da tela do DAST.
 *
 * SEGURANÇA
 * Todo texto vem de um arquivo enviado pelo usuário. Nada é renderizado como
 * HTML (sem dangerouslySetInnerHTML), e links externos só existem para URLs
 * http(s) — um `helpUri: "javascript:..."` num SARIF forjado vira texto puro.
 */

import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, FileDown, Upload } from "lucide-react";
import { codeImportsApi } from "../lib/api/code-imports.api";
import { useApiError } from "../hooks/use-api-error";
import { Breadcrumb } from "../components/ui/navigation";
import { Alert } from "../components/ui/alert";
import { Badge, SeverityBadge } from "../components/ui/badge";
import { Button, LinkButton } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Skeleton } from "../components/ui/card";
import { EmptyState, ErrorState } from "../components/ui/empty-state";
import { Tabs } from "../components/ui/tabs";
import { TABELA } from "../components/ui/table-estilos";
import { DastTriageControls } from "../components/dast/dast-triage-controls";
import { SeverityStrip } from "../components/code-imports/severity-strip";
import { CodePromoteDialog } from "../components/code-imports/code-promote-dialog";
import { CodeImportDialog } from "../components/code-imports/code-import-dialog";
import { cn } from "../lib/cn";
import { FILTROS_INICIAIS, filtrarAchados, urlSegura, type FiltrosAchados } from "../lib/code-import";
import {
  CODE_FORMAT_LABELS,
  CODE_SEVERITY_LABELS,
  CODE_SEVERITY_ORDER,
  localDoAchado,
  type CodeCategory,
  type CodeComparisonEntry,
  type CodeFinding,
  type CodeSeverity,
} from "../types/code-import.types";
import { DAST_TRIAGE_LABELS, DAST_TRIAGE_TONES, type DastTriageStatus } from "../types/dast.types";

const CLASSE_SELECT = "h-touch rounded-control border border-default bg-surface px-3 text-sm text-fg";

/** A severidade do SeverityBadge não tem INFO: cai no cinza de NONE, como no DAST. */
function severidadeDoBadge(s: CodeSeverity): string {
  return s === "INFO" ? "NONE" : s;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function CodeImportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const getErrorMessage = useApiError();
  const [filtros, setFiltros] = useState<FiltrosAchados>(FILTROS_INICIAIS);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [paraPromover, setParaPromover] = useState<string | null>(null);
  const [reimportando, setReimportando] = useState(false);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const importQuery = useQuery({ queryKey: ["code-imports", id], queryFn: () => codeImportsApi.getById(id!), enabled: !!id });
  const findingsQuery = useQuery({ queryKey: ["code-imports", id, "findings"], queryFn: () => codeImportsApi.listFindings(id!), enabled: !!id });
  const compareQuery = useQuery({ queryKey: ["code-imports", id, "compare"], queryFn: () => codeImportsApi.compare(id!), enabled: !!id });

  const findings = useMemo(() => findingsQuery.data ?? [], [findingsQuery.data]);
  const novos = useMemo(
    () => new Set(compareQuery.data?.baseImport ? compareQuery.data.introduced.map((e) => e.fingerprint) : []),
    [compareQuery.data],
  );
  const visiveis = useMemo(() => filtrarAchados(findings, filtros, novos), [findings, filtros, novos]);
  const porTriar = findings.filter((f) => f.triageStatus === "NEW").length;
  const promovidos = findings.filter((f) => f.promotedVulnerability).length;
  const findingDoDialogo = findings.find((f) => f.id === paraPromover) ?? null;

  async function baixarPdf(): Promise<void> {
    if (!id) return;
    setErro(null);
    setGerandoPdf(true);
    try {
      const data = await codeImportsApi.getReportData(id);
      // Tudo sob demanda, inclusive o downloadBlob: importar `lib/pdf/base`
      // estaticamente puxaria o pdf-lib para o chunk da página (WEB-FUT-01).
      const [{ generateCodeImportReportPdf }, { downloadBlob }] = await Promise.all([
        import("../lib/pdf/code-import-report"),
        import("../lib/pdf/base"),
      ]);
      const blob = await generateCodeImportReportPdf(data);
      downloadBlob(blob, `sast-sca-${slugify(data.import.projectName)}-${slugify(data.import.toolName)}-${data.import.createdAt.slice(0, 10)}.pdf`);
    } catch (err) {
      setErro(getErrorMessage(err));
    } finally {
      setGerandoPdf(false);
    }
  }

  if (importQuery.isLoading) {
    return (
      <div aria-busy="true" className="flex flex-col gap-4">
        <span className="sr-only">Carregando importação</span>
        <Skeleton className="h-24 w-full bg-inset" />
        <Skeleton className="h-24 w-full bg-inset" />
      </div>
    );
  }

  if (importQuery.isError || !importQuery.data) {
    return (
      <ErrorState
        titulo="Importação indisponível"
        descricao={importQuery.error ? getErrorMessage(importQuery.error) : "Não encontramos esta importação."}
        aoTentarNovamente={() => importQuery.refetch()}
      />
    );
  }

  const imp = importQuery.data;
  const alternarSeveridade = (s: CodeSeverity) =>
    setFiltros((f) => ({ ...f, severidades: f.severidades.includes(s) ? f.severidades.filter((x) => x !== s) : [...f.severidades, s] }));
  const filtrando = JSON.stringify(filtros) !== JSON.stringify(FILTROS_INICIAIS);

  const abaAchados = (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-container border border-subtle bg-surface p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-campo flex-1 flex-col gap-1 text-xs text-fg-muted">
            Buscar
            <Input
              value={filtros.busca}
              onChange={(e) => setFiltros((f) => ({ ...f, busca: e.target.value }))}
              placeholder="Título, regra, arquivo, pacote, CVE ou CWE"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-fg-muted">
            Origem
            <select className={CLASSE_SELECT} value={filtros.categoria} onChange={(e) => setFiltros((f) => ({ ...f, categoria: e.target.value as CodeCategory | "" }))}>
              <option value="">Todas</option>
              <option value="SAST">Código (SAST)</option>
              <option value="SCA">Dependências (SCA)</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-fg-muted">
            Triagem
            <select className={CLASSE_SELECT} value={filtros.triagem} onChange={(e) => setFiltros((f) => ({ ...f, triagem: e.target.value as DastTriageStatus | "" }))}>
              <option value="">Todas</option>
              {(Object.keys(DAST_TRIAGE_LABELS) as DastTriageStatus[]).map((s) => (
                <option key={s} value={s}>
                  {DAST_TRIAGE_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
          {imp.previousImportId && (
            <label className="flex h-touch items-center gap-2 text-sm text-fg">
              <input type="checkbox" checked={filtros.soNovos} onChange={(e) => setFiltros((f) => ({ ...f, soNovos: e.target.checked }))} />
              Só novos
            </label>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtrar por severidade">
          {CODE_SEVERITY_ORDER.map((s) => {
            const ativo = filtros.severidades.includes(s);
            return (
              <button
                key={s}
                type="button"
                aria-pressed={ativo}
                onClick={() => alternarSeveridade(s)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-colors duration-fast",
                  ativo ? "border-accent bg-accent-surface text-accent-ink" : "border-subtle text-fg-muted hover:bg-hovered",
                )}
              >
                {CODE_SEVERITY_LABELS[s]} <span className="font-mono" data-numeric>{imp.severityCounts[s]}</span>
              </button>
            );
          })}
          {filtrando && (
            <Button size="sm" variant="fantasma" onClick={() => setFiltros(FILTROS_INICIAIS)}>
              Limpar filtros
            </Button>
          )}
          <span className="ml-auto text-xs text-fg-muted" aria-live="polite">
            {visiveis.length} de {findings.length} {findings.length === 1 ? "achado" : "achados"}
          </span>
        </div>
      </div>

      {findingsQuery.isLoading && <Skeleton className="h-24 w-full bg-inset" />}
      {findingsQuery.isError && <ErrorState titulo="Não foi possível carregar os achados" aoTentarNovamente={() => findingsQuery.refetch()} />}

      {findingsQuery.isSuccess && findings.length === 0 && (
        <EmptyState
          titulo="Nenhum achado nesta importação"
          descricao={imp.warningMessage ?? "A ferramenta não reportou nada neste relatório. Se a anterior tinha achados, eles aparecem como resolvidos na aba Comparação."}
        />
      )}

      {findingsQuery.isSuccess && findings.length > 0 && visiveis.length === 0 && (
        <EmptyState titulo="Nenhum achado com esses filtros" acao={<Button variant="secundario" onClick={() => setFiltros(FILTROS_INICIAIS)}>Limpar filtros</Button>} />
      )}

      {visiveis.length > 0 && (
        <div data-ops-surface className="overflow-x-auto rounded-container border border-subtle">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Achados da importação</caption>
            <thead className={TABELA.cabecalho}>
              <tr>
                <th scope="col" className={TABELA.th}>Severidade</th>
                <th scope="col" className={TABELA.th}>Achado</th>
                <th scope="col" className={TABELA.th}>Triagem</th>
                <th scope="col" className={TABELA.th}>Local</th>
                <th scope="col" className={TABELA.th}><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((f) => (
                <LinhaAchado
                  key={f.id}
                  finding={f}
                  novo={novos.has(f.fingerprint)}
                  importId={imp.id}
                  expandido={expandido === f.id}
                  aoAlternar={() => setExpandido((atual) => (atual === f.id ? null : f.id))}
                  aoPromover={() => setParaPromover(f.id)}
                  aoErro={setErro}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const abaComparacao = compareQuery.data ? (
    compareQuery.data.baseImport ? (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-fg-muted">
          Comparado com a importação de{" "}
          <Link className="text-accent-ink underline" to={`/sast-sca/imports/${compareQuery.data.baseImport.id}`}>
            {new Date(compareQuery.data.baseImport.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
          </Link>{" "}
          ({compareQuery.data.baseImport.fileName}). Um achado que sumiu não está necessariamente corrigido: pode ter saído do
          escopo da análise. Se ele já era uma vulnerabilidade, reteste antes de fechá-la.
        </p>
        <div className="grid gap-4 lg:grid-cols-3">
          <ColunaComparacao titulo="Novos" tom="perigo" itens={compareQuery.data.introduced} vazio="Nada novo desde a anterior." />
          <ColunaComparacao titulo="Continuam" tom="atencao" itens={compareQuery.data.persisted} vazio="Nenhum achado se manteve." />
          <ColunaComparacao titulo="Resolvidos" tom="sucesso" itens={compareQuery.data.resolved} vazio="Nada sumiu desde a anterior." />
        </div>
      </div>
    ) : (
      <EmptyState
        titulo="Primeira importação desta ferramenta"
        descricao={`Importe uma nova versão do relatório do ${imp.toolName} neste projeto para ver o que apareceu, o que continua e o que foi resolvido.`}
        acao={<Button variant="secundario" onClick={() => setReimportando(true)}>Importar nova versão</Button>}
      />
    )
  ) : (
    <Skeleton className="h-24 w-full bg-inset" />
  );

  return (
    <div>
      <Breadcrumb
        itens={[
          { rotulo: "SAST/SCA", para: "/sast-sca" },
          { rotulo: imp.projectName, para: `/projects/${imp.projectId}` },
          { rotulo: imp.fileName },
        ]}
      />

      <div data-ops-hero="code" className="flex flex-col gap-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="mb-2 font-mono text-xs uppercase tracking-[0.14em] text-accent-ink">
              Importação {CODE_FORMAT_LABELS[imp.format]}
            </p>
            <h1 className="flex flex-wrap items-center gap-3 text-2xl font-bold text-fg">
              {imp.toolName}
              {imp.toolVersion && <span className="font-mono text-sm font-normal text-fg-muted">v{imp.toolVersion}</span>}
            </h1>
            <p className="mt-1 text-fg-muted">
              <Link className="text-accent-ink hover:underline" to={`/projects/${imp.projectId}`}>
                {imp.projectName}
              </Link>{" "}
              · {imp.applicationName} · <span className="font-mono text-xs">{imp.fileName}</span> · {imp.uploadedByName} em{" "}
              {new Date(imp.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secundario" onClick={() => setReimportando(true)}>
              <Upload size={16} aria-hidden="true" /> Importar nova versão
            </Button>
            <Button onClick={baixarPdf} disabled={gerandoPdf} carregando={gerandoPdf}>
              <FileDown size={16} aria-hidden="true" /> {gerandoPdf ? "Gerando PDF..." : "Baixar PDF"}
            </Button>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <Numero rotulo="Achados" valor={imp.totalFindings} />
          <Numero rotulo="Críticos" valor={imp.severityCounts.CRITICAL} classe="text-severity-critical-ink" />
          <Numero rotulo="Altos" valor={imp.severityCounts.HIGH} classe="text-severity-high-ink" />
          <Numero rotulo="Por triar" valor={porTriar} />
          <Numero rotulo="Novos" valor={imp.previousImportId ? imp.newFindings : null} />
          <Numero rotulo="Resolvidos" valor={imp.previousImportId ? imp.resolvedFindings : null} classe="text-success-ink" />
        </dl>
        <SeverityStrip counts={imp.severityCounts} legenda />
        <p className="text-xs text-fg-muted">
          {promovidos > 0 ? `${promovidos} ${promovidos === 1 ? "achado já é vulnerabilidade" : "achados já são vulnerabilidades"} do projeto. ` : ""}
          {imp.componentsCount != null ? `SBOM com ${imp.componentsCount} componentes declarados. ` : ""}
          {imp.persistedFindings > 0 ? `${imp.persistedFindings} continuam desde a importação anterior, com a triagem preservada.` : ""}
        </p>
      </div>

      {imp.warningMessage && (
        <Alert tom="atencao" className="mt-4" titulo="Avisos da importação">
          <span className="whitespace-pre-line">{imp.warningMessage}</span>
        </Alert>
      )}
      {erro && (
        <Alert tom="perigo" className="mt-4" aoFechar={() => setErro(null)}>
          {erro}
        </Alert>
      )}

      <Tabs
        className="mt-6"
        paramUrl="aba"
        abas={[
          { id: "achados", rotulo: "Achados", contagem: findings.length, conteudo: abaAchados },
          {
            id: "comparacao",
            rotulo: "Comparação",
            contagem: imp.previousImportId ? imp.newFindings + imp.resolvedFindings : undefined,
            conteudo: abaComparacao,
          },
        ]}
      />

      <CodePromoteDialog finding={findingDoDialogo} projetoNome={imp.projectName} aberto={!!paraPromover} aoFechar={() => setParaPromover(null)} />
      {reimportando && <CodeImportDialog aberto={reimportando} aoFechar={() => setReimportando(false)} projetoFixo={{ id: imp.projectId, name: imp.projectName }} />}
    </div>
  );
}

function Numero({ rotulo, valor, classe }: { rotulo: string; valor: number | null; classe?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs uppercase tracking-[0.1em] text-fg-muted">{rotulo}</dt>
      <dd className={cn("font-mono text-2xl font-bold text-fg", classe)} data-numeric>
        {valor ?? "—"}
      </dd>
    </div>
  );
}

function LinhaAchado({
  finding: f,
  novo,
  importId,
  expandido,
  aoAlternar,
  aoPromover,
  aoErro,
}: {
  finding: CodeFinding;
  novo: boolean;
  importId: string;
  expandido: boolean;
  aoAlternar: () => void;
  aoPromover: () => void;
  aoErro: (m: string | null) => void;
}) {
  const detalheId = `achado-${f.id}`;
  const promovido = f.promotedVulnerability;
  const link = urlSegura(f.helpUri);

  return (
    <>
      <tr className={TABELA.linha}>
        <td className={TABELA.celula}>
          <SeverityBadge severidade={severidadeDoBadge(f.severity)} />
        </td>
        <td className={cn(TABELA.celula, "max-w-xl")}>
          <span className="text-fg">{f.title}</span>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge tom={f.category === "SAST" ? "acento" : "neutro"}>{f.category}</Badge>
            {novo && <Badge tom="perigo">novo</Badge>}
            {f.advisoryId && <span className="font-mono text-xs text-fg-muted">{f.advisoryId}</span>}
            {f.cweId && <span className="font-mono text-xs text-fg-muted">CWE-{f.cweId}</span>}
          </div>
        </td>
        <td className={TABELA.celula}>
          <div className="flex flex-wrap items-center gap-1">
            <Badge tom={DAST_TRIAGE_TONES[f.triageStatus]}>{DAST_TRIAGE_LABELS[f.triageStatus]}</Badge>
            {f.triageInherited && (
              <Badge tom="neutro" title="Triagem herdada da importação anterior: o achado continuou aparecendo">
                herdada
              </Badge>
            )}
            {promovido && (
              <Badge tom="acento" title="Já é uma vulnerabilidade do projeto">
                promovido
              </Badge>
            )}
          </div>
        </td>
        <td className={cn(TABELA.celula, "max-w-xs truncate font-mono text-xs text-fg-muted")} title={localDoAchado(f)}>
          {localDoAchado(f)}
        </td>
        <td className={TABELA.celula}>
          <button
            type="button"
            aria-expanded={expandido}
            aria-controls={detalheId}
            onClick={aoAlternar}
            className="alvo-estendido rounded-control px-2 py-1 text-sm text-accent-ink hover:bg-hovered"
          >
            {expandido ? "Recolher" : "Detalhes"}
          </button>
        </td>
      </tr>
      {expandido && (
        <tr id={detalheId} className="border-t border-subtle bg-inset">
          <td colSpan={5} className="px-4 py-4">
            <div className="mb-4 flex flex-col gap-3">
              <DastTriageControls
                finding={f}
                aoErro={aoErro}
                salvar={(status, note) => codeImportsApi.triage(f.id, status, note)}
                queryKey={["code-imports", importId]}
              />
              <div className="flex flex-wrap items-center gap-2">
                {promovido ? (
                  <>
                    <LinkButton variant="secundario" size="sm" to={`/findings/${promovido.id}`}>
                      Abrir vulnerabilidade
                    </LinkButton>
                    <span className="text-xs text-fg-muted">
                      Promovido — severidade {promovido.severityFinal}, situação {promovido.status}.
                    </span>
                  </>
                ) : (
                  <>
                    <Button size="sm" onClick={aoPromover}>
                      Promover para vulnerabilidade
                    </Button>
                    <span className="text-xs text-fg-muted">Entra no fluxo do projeto com SLA, VRS, evidências e relatório.</span>
                  </>
                )}
              </div>
            </div>

            <dl className="grid gap-4 sm:grid-cols-2">
              <Item rotulo="Regra" valor={f.ruleId} mono />
              <Item rotulo={f.category === "SAST" ? "Arquivo" : "Componente"} valor={localDoAchado(f)} mono />
              {f.purl && <Item rotulo="Package URL" valor={f.purl} mono />}
              {f.fixedVersion && <Item rotulo="Versão corrigida" valor={f.fixedVersion} mono />}
              {f.cweId && (
                <div>
                  <dt className="text-xs font-medium uppercase text-fg-muted">CWE</dt>
                  <dd className="mt-1 text-sm">
                    <a className="inline-flex items-center gap-1 text-accent-ink hover:underline" href={`https://cwe.mitre.org/data/definitions/${f.cweId}.html`} target="_blank" rel="noopener noreferrer">
                      CWE-{f.cweId} <ExternalLink size={12} aria-hidden="true" />
                      <span className="sr-only">(abre em nova aba)</span>
                    </a>
                  </dd>
                </div>
              )}
              {f.cvssScore != null && <Item rotulo="Score da ferramenta" valor={`${f.cvssScore.toFixed(1)}${f.cvssVector ? ` · ${f.cvssVector}` : ""}`} mono />}
            </dl>

            {f.snippet && (
              <div className="mt-4">
                <p className="text-xs font-medium uppercase text-fg-muted">Trecho</p>
                <pre className="mt-1 overflow-x-auto rounded-control border border-subtle bg-surface p-3 font-mono text-xs text-fg">{f.snippet}</pre>
              </div>
            )}
            {f.description && <Bloco rotulo="Descrição" texto={f.description} />}
            {f.recommendation && <Bloco rotulo="Recomendação" texto={f.recommendation} />}
            {f.helpUri && (
              <div className="mt-4">
                <p className="text-xs font-medium uppercase text-fg-muted">Referência</p>
                {link ? (
                  <a className="mt-1 inline-flex items-center gap-1 break-all text-sm text-accent-ink hover:underline" href={link} target="_blank" rel="noopener noreferrer">
                    {link} <ExternalLink size={12} aria-hidden="true" />
                    <span className="sr-only">(abre em nova aba)</span>
                  </a>
                ) : (
                  <p className="mt-1 break-all font-mono text-xs text-fg-muted">{f.helpUri}</p>
                )}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function Item({ rotulo, valor, mono }: { rotulo: string; valor: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium uppercase text-fg-muted">{rotulo}</dt>
      <dd className={cn("mt-1 break-all text-sm text-fg", mono && "font-mono text-xs")}>{valor}</dd>
    </div>
  );
}

function Bloco({ rotulo, texto }: { rotulo: string; texto: string }) {
  return (
    <div className="mt-4">
      <p className="text-xs font-medium uppercase text-fg-muted">{rotulo}</p>
      <p className="mt-1 max-w-4xl whitespace-pre-line text-sm text-fg">{texto}</p>
    </div>
  );
}

function ColunaComparacao({
  titulo,
  tom,
  itens,
  vazio,
}: {
  titulo: string;
  tom: "perigo" | "atencao" | "sucesso";
  itens: CodeComparisonEntry[];
  vazio: string;
}) {
  return (
    <section aria-label={titulo} className="flex flex-col gap-3 rounded-container border border-subtle bg-surface p-4">
      <h3 className="flex items-center justify-between text-sm font-semibold text-fg">
        {titulo}
        <Badge tom={tom}>{itens.length}</Badge>
      </h3>
      {itens.length === 0 ? (
        <p className="text-sm text-fg-muted">{vazio}</p>
      ) : (
        <ul className="flex flex-col gap-2 overflow-y-auto pr-1" style={{ maxHeight: "28rem" }}>
          {itens.map((e) => (
            <li key={e.fingerprint} className="flex flex-col gap-1 rounded-control border border-subtle px-3 py-2">
              <div className="flex items-start gap-2">
                <SeverityBadge severidade={severidadeDoBadge(e.severity)} />
                <span className="text-sm text-fg">{e.title}</span>
              </div>
              {e.location && <span className="break-all font-mono text-xs text-fg-muted">{e.location}</span>}
              {e.promotedVulnerability && (
                <Link className="text-xs text-accent-ink hover:underline" to={`/findings/${e.promotedVulnerability.id}`}>
                  Vulnerabilidade {e.promotedVulnerability.status === "FIXED" ? "corrigida" : "registrada"} — abrir
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
