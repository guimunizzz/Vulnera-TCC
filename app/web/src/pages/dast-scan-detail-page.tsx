/**
 * dast-scan-detail-page.tsx
 *
 * Tela de acompanhamento de UM scan DAST. Enquanto QUEUED/RUNNING, faz
 * polling a cada 3s (encerra sozinho ao chegar num estado terminal) e mostra
 * BARRA DE PROGRESSO com percentual real, nome da fase e tempo decorrido —
 * sem isso, minutos de silêncio (spider + active scan do ZAP) parecem
 * travamento. Ao concluir, mostra os contadores por risco, a tabela de
 * findings (filtro + busca + linha expansível) e os dois botões de saída: PDF
 * client-side e relatório HTML original do ZAP.
 *
 * O percentual vem do backend (coluna `progress`), alimentado pela API do
 * OWASP ZAP fase a fase — não é estimativa de tempo. Quando o scan cai no
 * resultado simulado (Docker fora do ar ou falha do ZAP), a tela diz isso em
 * letras grandes: um resultado de demonstração não pode se passar por real
 * (docs/DAST-DOCKER-GAP.md §5).
 */

import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { dastApi } from "../lib/api/dast.api";
import { useApiError } from "../hooks/use-api-error";
import { Breadcrumb } from "../components/ui/navigation";
import { Button, LinkButton } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Alert } from "../components/ui/alert";
import { Badge, StatusBadge, SeverityBadge } from "../components/ui/badge";
import { Progress } from "../components/ui/progress";
import { useDastStatus } from "../components/dast/dast-status-banner";
import { EmptyState, ErrorState } from "../components/ui/empty-state";
import { Skeleton } from "../components/ui/card";
import { downloadBlob } from "../lib/pdf/base";
import { generateDastReportPdf } from "../lib/pdf/dast-report";
import {
  ACTIVE_DAST_STATUSES,
  DAST_RISK_LABELS,
  labelDaFase,
  type DastFinding,
  type DastRisk,
} from "../types/dast.types";

function formatElapsed(totalSeconds: number): string {
  const min = Math.floor(totalSeconds / 60);
  const sec = totalSeconds % 60;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function formatDuration(ms: number | null): string {
  if (ms == null) return "—";
  return formatElapsed(Math.round(ms / 1000));
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

const RISK_ORDER: Record<DastRisk, number> = { HIGH: 0, MEDIUM: 1, LOW: 2, INFO: 3 };
const RISK_TONE_CLASS: Record<DastRisk, string> = {
  HIGH: "text-severity-high-ink",
  MEDIUM: "text-severity-medium-ink",
  LOW: "text-severity-low-ink",
  INFO: "text-fg-muted",
};

function RiskCountCard({ risk, value }: { risk: DastRisk; value: number }) {
  return (
    <div className="flex flex-col gap-1 rounded-container border border-subtle bg-surface p-4">
      <span className="text-xs font-medium uppercase text-fg-muted">{DAST_RISK_LABELS[risk]}</span>
      <span className={`font-mono text-2xl font-bold ${RISK_TONE_CLASS[risk]}`} data-numeric>
        {value}
      </span>
    </div>
  );
}

function FindingRow({ finding, expanded, onToggle }: { finding: DastFinding; expanded: boolean; onToggle: () => void }) {
  const detailId = `finding-detalhe-${finding.id}`;
  return (
    <>
      <tr className="border-t border-subtle">
        <td className="px-4 py-3">
          <SeverityBadge severidade={finding.risk} />
        </td>
        <td className="px-4 py-3 text-fg">{finding.title}</td>
        <td className="px-4 py-3 font-mono text-xs text-fg-muted">{finding.confidence}</td>
        <td className="max-w-xs truncate px-4 py-3 font-mono text-xs text-fg-muted" title={finding.url}>
          {finding.url}
        </td>
        <td className="px-4 py-3">
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={detailId}
            onClick={onToggle}
            className="alvo-estendido rounded-control px-2 py-1 text-sm text-accent-ink hover:bg-hovered"
          >
            {expanded ? "Recolher" : "Detalhes"}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr id={detailId} className="border-t border-subtle bg-inset">
          <td colSpan={5} className="px-4 py-4">
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase text-fg-muted">URL</dt>
                <dd className="mt-1 break-all font-mono text-xs text-fg">{finding.url}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-fg-muted">Parâmetro</dt>
                <dd className="mt-1 font-mono text-xs text-fg">{finding.param ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-fg-muted">CWE</dt>
                <dd className="mt-1 text-fg">{finding.cweId ? `CWE-${finding.cweId}` : "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-fg-muted">WASC</dt>
                <dd className="mt-1 text-fg">{finding.wascId ?? "—"}</dd>
              </div>
              {finding.evidence && (
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium uppercase text-fg-muted">Evidência</dt>
                  <dd className="mt-1 whitespace-pre-wrap break-all rounded-control bg-canvas p-2 font-mono text-xs text-fg">
                    {finding.evidence}
                  </dd>
                </div>
              )}
              {finding.description && (
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium uppercase text-fg-muted">Descrição</dt>
                  <dd className="mt-1 whitespace-pre-wrap text-sm text-fg">{finding.description}</dd>
                </div>
              )}
              {finding.solution && (
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium uppercase text-fg-muted">Solução</dt>
                  <dd className="mt-1 whitespace-pre-wrap text-sm text-fg">{finding.solution}</dd>
                </div>
              )}
            </dl>
          </td>
        </tr>
      )}
    </>
  );
}

export function DastScanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const getErrorMessage = useApiError();
  const queryClient = useQueryClient();

  const [error, setError] = useState<string | null>(null);
  const [riskFilter, setRiskFilter] = useState<DastRisk | "">("");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const scanQuery = useQuery({
    queryKey: ["dast", "scans", id],
    queryFn: () => dastApi.getById(id!),
    enabled: !!id,
    // 3s: mesma cadência com que o runner atualiza o percentual no banco.
    refetchInterval: (query) =>
      query.state.data && ACTIVE_DAST_STATUSES.includes(query.state.data.status) ? 3000 : false,
  });

  const scan = scanQuery.data;
  const isActive = !!scan && ACTIVE_DAST_STATUSES.includes(scan.status);

  // Só pra descobrir a posição na fila deste scan — quando ele ainda não
  // ganhou vaga, "5%" não explica nada e "2º da fila" explica tudo.
  const statusQuery = useDastStatus();
  const posicaoNaFila = statusQuery.data?.queued.find((q) => q.scanId === id)?.position ?? null;

  const findingsQuery = useQuery({
    queryKey: ["dast", "scans", id, "findings"],
    queryFn: () => dastApi.listFindings(id!),
    enabled: !!id && scan?.status === "COMPLETED",
  });

  // Tempo decorrido — tique próprio de 1s, independente do polling de 5s do
  // status (senão o cronômetro andaria "aos pulos" de 5 em 5 segundos).
  // Deps propositalmente restritas a startedAt/isActive — o polling de 5s
  // troca a referência de `scan` inteiro a cada tick sem mudar `startedAt`;
  // incluir `scan` reiniciaria o interval a cada refetch à toa.
  useEffect(() => {
    if (!scan || !isActive) return;
    const startedAt = scan.startedAt ? new Date(scan.startedAt).getTime() : Date.now();
    const tick = () => setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scan?.startedAt, isActive]);

  const cancelMutation = useMutation({
    mutationFn: () => dastApi.cancel(id!),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["dast", "scans", id] });
    },
    onError: (err: unknown) => setError(getErrorMessage(err)),
  });

  const filteredFindings = useMemo(() => {
    if (!findingsQuery.data) return [];
    const term = search.trim().toLowerCase();
    return findingsQuery.data
      .filter((f) => (!riskFilter || f.risk === riskFilter) && (!term || f.title.toLowerCase().includes(term)))
      .sort((a, b) => RISK_ORDER[a.risk] - RISK_ORDER[b.risk]);
  }, [findingsQuery.data, riskFilter, search]);

  async function handleDownloadPdf(): Promise<void> {
    if (!id) return;
    setIsGeneratingPdf(true);
    setError(null);
    try {
      const data = await dastApi.getReportData(id);
      const blob = await generateDastReportPdf(data);
      const fileName = `dast-${slugify(data.scan.targetUrl)}-${new Date().toISOString().slice(0, 10)}.pdf`;
      downloadBlob(blob, fileName);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsGeneratingPdf(false);
    }
  }

  if (scanQuery.isLoading) {
    return (
      <div>
        <Breadcrumb itens={[{ rotulo: "DAST", para: "/dast" }, { rotulo: "Carregando..." }]} />
        <div className="mt-6 flex flex-col gap-2" aria-busy="true">
          <span className="sr-only">Carregando scan</span>
          <Skeleton className="h-8 w-64 bg-inset" />
          <Skeleton className="h-24 w-full bg-inset" />
        </div>
      </div>
    );
  }

  if (scanQuery.isError || !scan) {
    return (
      <div>
        <Breadcrumb itens={[{ rotulo: "DAST", para: "/dast" }, { rotulo: "Scan" }]} />
        <ErrorState
          className="mt-6"
          titulo="Não foi possível carregar este scan"
          descricao="Ele pode ter sido removido, ou você não tem acesso a ele."
          aoTentarNovamente={() => scanQuery.refetch()}
        />
      </div>
    );
  }

  return (
    <div>
      <Breadcrumb itens={[{ rotulo: "DAST", para: "/dast" }, { rotulo: scan.targetUrl }]} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="break-all text-2xl font-bold text-fg">{scan.targetUrl}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <StatusBadge status={scan.status} />
            {scan.simulated && (
              <Badge tom="atencao" title="Resultado gerado sem executar o OWASP ZAP">
                resultado simulado
              </Badge>
            )}
            <span className="text-sm text-fg-muted">Duração: {formatDuration(scan.durationMs)}</span>
          </div>
        </div>

        <div className="flex gap-2">
          {isActive && (
            <Button variant="destrutivo" onClick={() => cancelMutation.mutate()} disabled={cancelMutation.isPending}>
              {cancelMutation.isPending ? "Parando..." : "Parar"}
            </Button>
          )}
          {scan.status === "COMPLETED" && (
            <>
              <Button onClick={handleDownloadPdf} disabled={isGeneratingPdf}>
                {isGeneratingPdf ? "Gerando PDF..." : "Baixar PDF"}
              </Button>
              <LinkButton
                variant="secundario"
                to={`/dast/scans/${scan.id}/report`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Ver relatório do ZAP
              </LinkButton>
            </>
          )}
        </div>
      </div>

      {error && (
        <Alert tom="perigo" className="mt-4" aoFechar={() => setError(null)}>
          {error}
        </Alert>
      )}

      {isActive && (
        <div className="mt-4 rounded-container border border-subtle bg-surface p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-medium text-fg">
              {posicaoNaFila ? `Aguardando vaga — ${posicaoNaFila}º da fila` : labelDaFase(scan.phase)}
            </h2>
            <span className="font-mono text-sm text-fg-muted" data-numeric>
              Tempo decorrido: {formatElapsed(elapsedSeconds)}
            </span>
          </div>

          <Progress
            className="mt-3"
            valor={scan.progress}
            rotulo="Progresso do scan"
            textoDoValor={`${scan.progress}% — ${labelDaFase(scan.phase)}`}
            mostrarValor
          />

          <p className="mt-3 text-sm text-fg-muted">
            {posicaoNaFila
              ? "Rodamos no máximo alguns scans ao mesmo tempo para não sobrecarregar a máquina. Este começa sozinho assim que uma vaga liberar — pode deixar a tela aberta."
              : "O ZAP primeiro rastreia o alvo (spider) e depois testa ativamente cada página encontrada (active scan). Isso costuma levar alguns minutos — esta tela atualiza sozinha, nenhuma ação é necessária."}
          </p>
        </div>
      )}

      {scan.status === "COMPLETED" && scan.simulated && (
        <Alert tom="atencao" className="mt-4" titulo="Estes achados são de demonstração, não do seu alvo">
          {scan.warningMessage ??
            "O OWASP ZAP não pôde ser executado, então exibimos um conjunto de achados de demonstração no lugar."}
        </Alert>
      )}

      {scan.status === "FAILED" && (
        <Alert tom="perigo" className="mt-4">
          Scan falhou: {scan.errorMessage ?? "erro desconhecido"}
        </Alert>
      )}

      {scan.status === "CANCELLED" && (
        <Alert tom="atencao" className="mt-4">
          Este scan foi cancelado{scan.errorMessage ? `: ${scan.errorMessage}` : "."}
        </Alert>
      )}

      {scan.status === "COMPLETED" && (
        <>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <RiskCountCard risk="HIGH" value={scan.alertsHigh} />
            <RiskCountCard risk="MEDIUM" value={scan.alertsMedium} />
            <RiskCountCard risk="LOW" value={scan.alertsLow} />
            <RiskCountCard risk="INFO" value={scan.alertsInfo} />
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value as DastRisk | "")}
              className="h-touch rounded-control border border-default bg-surface px-3 text-sm text-fg"
              aria-label="Filtrar por risco"
            >
              <option value="">Todos os riscos</option>
              <option value="HIGH">{DAST_RISK_LABELS.HIGH}</option>
              <option value="MEDIUM">{DAST_RISK_LABELS.MEDIUM}</option>
              <option value="LOW">{DAST_RISK_LABELS.LOW}</option>
              <option value="INFO">{DAST_RISK_LABELS.INFO}</option>
            </select>
            <Input
              placeholder="Buscar por título..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
              aria-label="Buscar findings por título"
            />
          </div>

          {findingsQuery.isLoading && (
            <div className="mt-4 flex flex-col gap-2" aria-busy="true">
              <span className="sr-only">Carregando findings</span>
              <Skeleton className="h-10 w-full bg-inset" />
              <Skeleton className="h-10 w-full bg-inset" />
            </div>
          )}

          {findingsQuery.isError && (
            <ErrorState className="mt-4" titulo="Não foi possível carregar os findings" aoTentarNovamente={() => findingsQuery.refetch()} />
          )}

          {!findingsQuery.isLoading && !findingsQuery.isError && filteredFindings.length === 0 && (
            <EmptyState
              className="mt-4"
              titulo={(findingsQuery.data?.length ?? 0) === 0 ? "Nenhum achado neste scan" : "Nenhum achado com esse filtro"}
              descricao={
                (findingsQuery.data?.length ?? 0) === 0
                  ? "O ZAP não encontrou nenhum alerta dentro do escopo do alvo."
                  : "Ajuste a busca ou o filtro de risco."
              }
            />
          )}

          {filteredFindings.length > 0 && (
            <div className="mt-4 overflow-x-auto rounded-container border border-subtle">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface text-fg-muted">
                  <tr>
                    <th className="px-4 py-3 font-medium">Risco</th>
                    <th className="px-4 py-3 font-medium">Título</th>
                    <th className="px-4 py-3 font-medium">Confiança</th>
                    <th className="px-4 py-3 font-medium">URL</th>
                    <th className="px-4 py-3 font-medium">
                      <span className="sr-only">Expandir</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFindings.map((finding) => (
                    <FindingRow
                      key={finding.id}
                      finding={finding}
                      expanded={expandedId === finding.id}
                      onToggle={() => setExpandedId(expandedId === finding.id ? null : finding.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
