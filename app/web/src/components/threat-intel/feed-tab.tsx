/**
 * feed-tab.tsx
 *
 * Duas abas da Threat Intel (ADR-053):
 *  - FEED: as CVEs publicadas (NVD) e as que entraram no KEV nos últimos dias,
 *    com "afeta você" quando casam com o inventário da empresa. É a
 *    visibilidade geral; a aba "Afeta você" é o que pede ação.
 *  - FONTES: o resultado de cada fonte nas últimas sincronizações. Uma fonte
 *    fora do ar aparece aqui com o motivo, nunca como "0 CVEs".
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Flame, RefreshCw } from "lucide-react";
import { threatIntelApi } from "../../lib/api/threat-intel.api";
import { useApiError } from "../../hooks/use-api-error";
import { Badge, SeverityBadge } from "../ui/badge";
import { Button } from "../ui/button";
import { Alert } from "../ui/alert";
import { Skeleton } from "../ui/card";
import { EmptyState, ErrorState } from "../ui/empty-state";
import { TABELA } from "../ui/table-estilos";
import { cn } from "../../lib/cn";
import { ROTULO_FONTE, type ExecucaoSync, type PermissoesThreatIntel } from "../../types/threat-intel.types";
import { haQuanto, pct } from "../../lib/threat-intel";

const CLASSE_SELECT = "h-touch rounded-control border border-default bg-surface px-3 text-sm text-fg";
const ROTULO_GATILHO: Record<ExecucaoSync["trigger"], string> = { SCHEDULED: "Agendada", MANUAL: "Manual", ASSET: "Inventário" };
const TOM_STATUS: Record<ExecucaoSync["status"], "sucesso" | "atencao" | "perigo" | "neutro"> = { OK: "sucesso", PARTIAL: "atencao", FAILED: "perigo", RUNNING: "neutro" };
const ROTULO_STATUS: Record<ExecucaoSync["status"], string> = { OK: "OK", PARTIAL: "Parcial", FAILED: "Falhou", RUNNING: "Rodando" };

export function FeedTab({ companyId }: { companyId: string }) {
  const getErrorMessage = useApiError();
  const [dias, setDias] = useState(3);
  const [soKev, setSoKev] = useState(false);
  const [severidade, setSeveridade] = useState("CRITICAL,HIGH");
  const consulta = useQuery({
    queryKey: ["threat-intel", "feed", companyId, dias, soKev, severidade],
    queryFn: () => threatIntelApi.feed(companyId, { days: dias, kev: soKev, severity: severidade || undefined }),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium uppercase text-fg-muted">
          Período
          <select className={CLASSE_SELECT} value={dias} onChange={(e) => setDias(Number(e.target.value))}>
            <option value={1}>Últimas 24 h</option>
            <option value={3}>Últimos 3 dias</option>
            <option value={7}>Últimos 7 dias</option>
            <option value={30}>Últimos 30 dias</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium uppercase text-fg-muted">
          Severidade
          <select className={CLASSE_SELECT} value={severidade} onChange={(e) => setSeveridade(e.target.value)}>
            <option value="CRITICAL,HIGH">Crítica e alta</option>
            <option value="CRITICAL">Só crítica</option>
            <option value="">Todas</option>
          </select>
        </label>
        <label className="flex h-touch items-center gap-2 text-sm text-fg">
          <input type="checkbox" checked={soKev} onChange={(e) => setSoKev(e.target.checked)} /> Só as que entraram no KEV
        </label>
        <span className="ml-auto text-sm text-fg-muted" aria-live="polite">
          {consulta.data ? `${consulta.data.length} CVE${consulta.data.length === 1 ? "" : "s"}${consulta.data.length >= 300 ? " (as 300 mais recentes)" : ""}` : ""}
        </span>
      </div>

      {consulta.isLoading ? (
        <Skeleton className="h-24 w-full bg-inset" />
      ) : consulta.isError ? (
        <ErrorState titulo="Não foi possível carregar o feed" descricao={getErrorMessage(consulta.error)} aoTentarNovamente={() => consulta.refetch()} />
      ) : consulta.data!.length === 0 ? (
        <EmptyState titulo="Nada publicado neste recorte" descricao="O feed é preenchido pela sincronização (a cada 6 h). Veja a aba Fontes." />
      ) : (
        <div data-ops-surface className="overflow-x-auto rounded-container border border-subtle">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">CVEs publicadas recentemente</caption>
            <thead className={TABELA.cabecalho}>
              <tr>
                <th scope="col" className={TABELA.th}>CVE</th>
                <th scope="col" className={TABELA.th}>Severidade</th>
                <th scope="col" className={cn(TABELA.th, "hidden md:table-cell")}>Publicada</th>
                <th scope="col" className={cn(TABELA.th, "hidden md:table-cell")}>EPSS</th>
                <th scope="col" className={TABELA.th}>Para você</th>
              </tr>
            </thead>
            <tbody>
              {consulta.data!.map((a) => (
                <tr key={a.id} className={TABELA.linha}>
                  <td className={TABELA.celula} style={a.afeta ? { boxShadow: "inset 3px 0 0 0 oklch(var(--color-danger-ink))" } : undefined}>
                    <span className="flex flex-col gap-1">
                      <span className="flex flex-wrap items-center gap-2 font-mono text-sm font-semibold text-fg">
                        <a className="hover:underline" href={`https://nvd.nist.gov/vuln/detail/${encodeURIComponent(a.id)}`} target="_blank" rel="noopener noreferrer">
                          {a.id}
                        </a>
                        {a.kev && (
                          <Badge tom="perigo">
                            <Flame size={12} className="mr-1 inline" aria-hidden="true" />
                            KEV
                          </Badge>
                        )}
                      </span>
                      {a.title && <span className="max-w-xl text-xs text-fg-muted">{a.title}</span>}
                    </span>
                  </td>
                  <td className={TABELA.celula}>
                    {a.severity ? <SeverityBadge severidade={a.severity} cvss={a.cvssScore ?? undefined} /> : <span className="text-xs text-fg-muted">sem nota ainda</span>}
                  </td>
                  <td className={cn(TABELA.celula, "hidden text-fg-muted md:table-cell")}>
                    {a.publishedAt ? haQuanto(a.publishedAt) : a.kevAddedAt ? `no KEV ${haQuanto(a.kevAddedAt)}` : "—"}
                  </td>
                  <td className={cn(TABELA.celula, "hidden md:table-cell")}>{pct(a.epssScore)}</td>
                  <td className={TABELA.celula}>{a.afeta ? <Badge tom="perigo">Afeta você</Badge> : <span className="text-xs text-fg-muted">não casa com o inventário</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function FontesTab({ companyId, permissoes }: { companyId: string; permissoes: PermissoesThreatIntel }) {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  const [aviso, setAviso] = useState<string | null>(null);
  const consulta = useQuery({
    queryKey: ["threat-intel", "sync", companyId],
    queryFn: () => threatIntelApi.syncStatus(companyId),
    // Enquanto sincroniza, acompanha; parado, não gasta requisição.
    refetchInterval: (q) => (q.state.data?.sincronizando ? 4000 : false),
  });
  const sincronizar = useMutation({
    mutationFn: () => threatIntelApi.syncNow(),
    onSuccess: (r) => {
      setAviso(r.iniciada ? "Sincronização iniciada. Os resultados aparecem aqui em instantes." : "Já há uma sincronização em andamento.");
      void queryClient.invalidateQueries({ queryKey: ["threat-intel"] });
    },
    onError: (e) => setAviso(getErrorMessage(e)),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-fg-muted">
          A cada 6 horas o Vulnera consulta o <strong>CISA KEV</strong> (exploração ativa), o <strong>NVD</strong> (CVEs publicadas e por produto), o{" "}
          <strong>OSV</strong> (avisos de pacotes) e o <strong>FIRST EPSS</strong> (probabilidade de exploração), e cruza com o inventário.
        </p>
        {permissoes.sincronizar && (
          <Button onClick={() => sincronizar.mutate()} disabled={sincronizar.isPending || consulta.data?.sincronizando} carregando={sincronizar.isPending}>
            <RefreshCw size={16} aria-hidden="true" /> {consulta.data?.sincronizando ? "Sincronizando..." : "Sincronizar agora"}
          </Button>
        )}
      </div>
      {aviso && (
        <Alert tom="info" aoFechar={() => setAviso(null)}>
          {aviso}
        </Alert>
      )}
      {consulta.isLoading ? (
        <Skeleton className="h-24 w-full bg-inset" />
      ) : consulta.isError ? (
        <ErrorState titulo="Não foi possível carregar as sincronizações" descricao={getErrorMessage(consulta.error)} aoTentarNovamente={() => consulta.refetch()} />
      ) : consulta.data!.execucoes.length === 0 ? (
        <EmptyState titulo="Nenhuma sincronização ainda" descricao="A primeira roda 1 minuto depois de a API subir." />
      ) : (
        <ul className="flex flex-col gap-3">
          {consulta.data!.execucoes.map((e) => (
            <li key={e.id} className="flex flex-col gap-2 rounded-container border border-subtle bg-surface p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tom={TOM_STATUS[e.status]}>{ROTULO_STATUS[e.status]}</Badge>
                <span className="text-sm text-fg">{ROTULO_GATILHO[e.trigger]}</span>
                <span className="text-xs text-fg-muted">
                  {new Date(e.startedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "medium" })}
                  {e.finishedAt ? ` · ${Math.max(1, Math.round((new Date(e.finishedAt).getTime() - new Date(e.startedAt).getTime()) / 1000))} s` : ""}
                </span>
                <span className="ml-auto text-xs text-fg-muted">
                  {e.newAdvisories} avisos novos · {e.newMatches} casamentos · {e.notifications} notificações
                </span>
              </div>
              <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {Object.entries(e.sources).map(([fonte, r]) => (
                  <div key={fonte} className="rounded-control border border-subtle px-3 py-2">
                    <dt className="text-xs font-medium uppercase text-fg-muted">{ROTULO_FONTE[fonte] ?? fonte}</dt>
                    <dd className={cn("text-sm", r.ok ? "text-fg" : "text-danger-ink")}>
                      {r.ok ? `${r.itens} ${r.itens === 1 ? "item" : "itens"}` : "Indisponível"}
                      {r.erro && <span className="block text-xs text-fg-muted">{r.erro}</span>}
                    </dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
