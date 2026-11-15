/**
 * afeta-tab.tsx
 *
 * "Afeta você" (ADR-053): as CVEs que casaram com o inventário da empresa,
 * explorada ativamente (KEV) e mais grave primeiro. Cada linha diz POR QUE
 * afeta (a tecnologia e se a versão foi confirmada), o que fazer (versão
 * corrigida) e quão provável é a exploração (EPSS). Expandir mostra a triagem
 * e a promoção para vulnerabilidade.
 *
 * "Já existia ao mapear" (D19.7): a CVE foi publicada antes de a tecnologia
 * entrar no inventário — é exposição, mas não gerou notificação.
 */

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Flame } from "lucide-react";
import { threatIntelApi } from "../../lib/api/threat-intel.api";
import { useApiError } from "../../hooks/use-api-error";
import { Badge, SeverityBadge } from "../ui/badge";
import { Button } from "../ui/button";
import { Alert } from "../ui/alert";
import { Skeleton } from "../ui/card";
import { EmptyState, ErrorState } from "../ui/empty-state";
import { TABELA } from "../ui/table-estilos";
import { DastTriageControls } from "../dast/dast-triage-controls";
import { PromoverDialog } from "./promover-dialog";
import { cn } from "../../lib/cn";
import { linkSeguro, pct } from "../../lib/threat-intel";
import { DAST_TRIAGE_LABELS, DAST_TRIAGE_TONES } from "../../types/dast.types";
import type { CasamentoTI, PermissoesThreatIntel } from "../../types/threat-intel.types";

const CLASSE_SELECT = "h-touch rounded-control border border-default bg-surface px-3 text-sm text-fg";

export function AfetaTab({ companyId, permissoes, matchInicial }: { companyId: string; permissoes: PermissoesThreatIntel; matchInicial: string | null }) {
  const getErrorMessage = useApiError();
  const [triagem, setTriagem] = useState("NEW,CONFIRMED");
  const [soKev, setSoKev] = useState(false);
  const [semPreexistentes, setSemPreexistentes] = useState(false);
  const [expandido, setExpandido] = useState<string | null>(matchInicial);
  const [paraPromover, setParaPromover] = useState<CasamentoTI | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const consulta = useQuery({
    queryKey: ["threat-intel", "matches", companyId, triagem, soKev],
    queryFn: () => threatIntelApi.matches(companyId, { triage: triagem || undefined, kev: soKev }),
  });
  const linhas = useMemo(() => (consulta.data ?? []).filter((m) => !semPreexistentes || !m.preexisting), [consulta.data, semPreexistentes]);

  // Veio de uma notificação: abre e mostra a CVE apontada.
  useEffect(() => {
    if (!matchInicial || !consulta.data) return;
    setExpandido(matchInicial);
    window.setTimeout(() => document.getElementById(`cve-${matchInicial}`)?.scrollIntoView({ block: "center" }), 100);
  }, [matchInicial, consulta.data]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium uppercase text-fg-muted">
          Triagem
          <select className={CLASSE_SELECT} value={triagem} onChange={(e) => setTriagem(e.target.value)}>
            <option value="NEW,CONFIRMED">Em aberto (novas e confirmadas)</option>
            <option value="NEW">Só as não triadas</option>
            <option value="">Todas</option>
            <option value="FALSE_POSITIVE,ACCEPTED_RISK">Descartadas ou com risco aceito</option>
          </select>
        </label>
        <label className="flex h-touch items-center gap-2 text-sm text-fg">
          <input type="checkbox" checked={soKev} onChange={(e) => setSoKev(e.target.checked)} /> Só exploradas ativamente (KEV)
        </label>
        <label className="flex h-touch items-center gap-2 text-sm text-fg">
          <input type="checkbox" checked={semPreexistentes} onChange={(e) => setSemPreexistentes(e.target.checked)} /> Só as publicadas depois do mapeamento
        </label>
        <span className="ml-auto text-sm text-fg-muted" aria-live="polite">
          {consulta.data ? `${linhas.length} CVE${linhas.length === 1 ? "" : "s"}` : ""}
        </span>
      </div>

      {erro && (
        <Alert tom="perigo" aoFechar={() => setErro(null)}>
          {erro}
        </Alert>
      )}

      {consulta.isLoading ? (
        <Skeleton className="h-24 w-full bg-inset" />
      ) : consulta.isError ? (
        <ErrorState titulo="Não foi possível carregar as CVEs" descricao={getErrorMessage(consulta.error)} aoTentarNovamente={() => consulta.refetch()} />
      ) : linhas.length === 0 ? (
        <EmptyState
          titulo="Nenhuma CVE neste recorte"
          descricao="Quando uma CVE publicada casar com uma tecnologia do inventário, ela aparece aqui. Confira se o inventário está completo na aba Inventário."
        />
      ) : (
        <div data-ops-surface className="overflow-x-auto rounded-container border border-subtle">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">CVEs que afetam o inventário da empresa</caption>
            <thead className={TABELA.cabecalho}>
              <tr>
                <th scope="col" className={TABELA.th}>CVE</th>
                <th scope="col" className={TABELA.th}>Severidade</th>
                <th scope="col" className={TABELA.th}>Tecnologia</th>
                <th scope="col" className={cn(TABELA.th, "hidden md:table-cell")}>Exploração</th>
                <th scope="col" className={cn(TABELA.th, "hidden md:table-cell")}>Corrigida em</th>
                <th scope="col" className={TABELA.th}>Triagem</th>
                <th scope="col" className={TABELA.th}>
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((m) => (
                <LinhaCasamento
                  key={m.id}
                  m={m}
                  permissoes={permissoes}
                  aberta={expandido === m.id}
                  aoAlternar={() => setExpandido((x) => (x === m.id ? null : m.id))}
                  aoPromover={() => setParaPromover(m)}
                  aoErro={setErro}
                  queryKey={["threat-intel", "matches", companyId]}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <PromoverDialog casamento={paraPromover} aoFechar={() => setParaPromover(null)} />
    </div>
  );
}

function LinhaCasamento({
  m,
  permissoes,
  aberta,
  aoAlternar,
  aoPromover,
  aoErro,
  queryKey,
}: {
  m: CasamentoTI;
  permissoes: PermissoesThreatIntel;
  aberta: boolean;
  aoAlternar: () => void;
  aoPromover: () => void;
  aoErro: (msg: string | null) => void;
  queryKey: readonly unknown[];
}) {
  const a = m.advisory;
  return (
    <>
      <tr id={`cve-${m.id}`} className={cn(TABELA.linha, aberta && "bg-inset")}>
        <td className={TABELA.celula}>
          <span className="flex flex-col gap-1">
            <span className="flex flex-wrap items-center gap-2 font-mono text-sm font-semibold text-fg">
              {a.id}
              {a.kev && (
                <Badge tom="perigo" title="Está no catálogo KEV da CISA: há exploração ativa conhecida.">
                  <Flame size={12} className="mr-1 inline" aria-hidden="true" />
                  KEV
                </Badge>
              )}
            </span>
            {a.title && <span className="max-w-md text-xs text-fg-muted">{a.title}</span>}
          </span>
        </td>
        <td className={TABELA.celula}>
          {a.severity ? <SeverityBadge severidade={a.severity} cvss={a.cvssScore ?? undefined} /> : <span className="text-xs text-fg-muted">sem nota ainda</span>}
        </td>
        <td className={TABELA.celula}>
          <span className="flex flex-col gap-1">
            <span className="text-sm text-fg">{m.asset.displayName}</span>
            <span className="flex flex-wrap gap-1">
              {!m.versionConfirmed && <Badge tom="atencao">versão não confirmada</Badge>}
              {m.preexisting && <Badge title="Publicada antes de a tecnologia entrar no inventário: não gerou notificação.">já existia ao mapear</Badge>}
            </span>
          </span>
        </td>
        <td className={cn(TABELA.celula, "hidden md:table-cell")}>
          <span className="text-sm text-fg" title="EPSS: probabilidade de exploração nos próximos 30 dias">
            EPSS {pct(a.epssScore)}
          </span>
        </td>
        <td className={cn(TABELA.celula, "hidden font-mono text-xs md:table-cell")}>{m.fixedVersion ?? "—"}</td>
        <td className={TABELA.celula}>
          <Badge tom={DAST_TRIAGE_TONES[m.triageStatus]}>{DAST_TRIAGE_LABELS[m.triageStatus]}</Badge>
        </td>
        <td className={TABELA.celula}>
          <Button variant="secundario" size="sm" aria-expanded={aberta} onClick={aoAlternar}>
            Detalhes
          </Button>
        </td>
      </tr>
      {aberta && (
        <tr className="bg-inset">
          <td colSpan={7} className="px-4 py-4">
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="flex flex-col gap-4">
                {permissoes.triar ? (
                  <DastTriageControls
                    finding={{ id: m.id, triageStatus: m.triageStatus, triageNote: m.triageNote, triagedByName: m.triagedByName, triagedAt: m.triagedAt }}
                    aoErro={aoErro}
                    salvar={(status, nota) => threatIntelApi.triage(m.id, status, nota)}
                    queryKey={queryKey}
                  />
                ) : (
                  <p className="text-sm text-fg-muted">Triagem: {DAST_TRIAGE_LABELS[m.triageStatus]}{m.triageNote ? ` — ${m.triageNote}` : ""}</p>
                )}
                {m.promotedVulnerability ? (
                  <Link className="text-sm text-accent-ink hover:underline" to={`/findings/${m.promotedVulnerability.id}`}>
                    Já é vulnerabilidade — abrir
                  </Link>
                ) : (
                  permissoes.promover && (
                    <Button className="self-start" onClick={aoPromover}>
                      Promover para vulnerabilidade
                    </Button>
                  )
                )}
              </div>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <Dado rotulo="CVSS" valor={a.cvssScore !== null ? `${a.cvssScore.toFixed(1)} (${a.cvssVersion ?? "?"})` : "sem nota ainda"} />
                <Dado rotulo="Publicada" valor={a.publishedAt ? new Date(a.publishedAt).toLocaleDateString("pt-BR") : "—"} />
                <Dado rotulo="EPSS" valor={a.epssScore !== null ? `${pct(a.epssScore)} (percentil ${pct(a.epssPercentile)})` : "—"} />
                <Dado rotulo="KEV" valor={a.kev ? `desde ${a.kevAddedAt ? new Date(a.kevAddedAt).toLocaleDateString("pt-BR") : "?"}${a.kevRansomware ? " · usada por ransomware" : ""}` : "não"} />
                <Dado rotulo="CWE" valor={a.cweId ? `CWE-${a.cweId}` : "—"} />
                <Dado rotulo="Fonte" valor={`${a.source}${a.aliases.length ? ` · ${a.aliases.slice(0, 2).join(", ")}` : ""}`} />
                {a.description && (
                  <div className="col-span-2">
                    <dt className="text-xs font-medium uppercase text-fg-muted">Descrição</dt>
                    {/* Texto de fonte externa: sempre texto, nunca HTML. */}
                    <dd className="mt-1 whitespace-pre-line text-sm text-fg">{a.description}</dd>
                  </div>
                )}
                {a.references.length > 0 && (
                  <div className="col-span-2 flex flex-col gap-1">
                    <dt className="text-xs font-medium uppercase text-fg-muted">Referências</dt>
                    {a.references.map((r) =>
                      linkSeguro(r) ? (
                        <dd key={r}>
                          <a className="inline-flex items-center gap-1 break-all text-xs text-accent-ink hover:underline" href={r} target="_blank" rel="noopener noreferrer">
                            {r} <ExternalLink size={12} aria-hidden="true" />
                          </a>
                        </dd>
                      ) : (
                        <dd key={r} className="break-all text-xs text-fg-muted">
                          {r}
                        </dd>
                      ),
                    )}
                  </div>
                )}
              </dl>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function Dado({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium uppercase text-fg-muted">{rotulo}</dt>
      <dd className="mt-1 break-words text-sm text-fg">{valor}</dd>
    </div>
  );
}
