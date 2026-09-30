/**
 * dast-page.tsx
 *
 * Lista de scans com escolha explícita entre demonstração e análise real.
 * O modo real exige uma segunda confirmação de autorização antes do POST.
 * Visível só pra PENTESTER/ADMIN
 * — a rota em App.tsx e o item no Sidebar já restringem o acesso.
 *
 * Polling leve na própria listagem (não só no detalhe): enquanto existir
 * QUALQUER scan QUEUED/RUNNING, a lista se atualiza sozinha a cada 3s, pra
 * quem está de olho na fila ver progresso e contadores mudarem sem recarregar.
 *
 * Desde 2026-09-09 a tela também mostra o estado do MÓDULO (banner do topo:
 * Docker disponível, vagas ocupadas, fila, avisos do watchdog) e marca com
 * selo os scans cujo resultado é simulado — sem isso um resultado de
 * demonstração era indistinguível de um scan real (docs/DAST-DOCKER-GAP.md §5).
 */

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { dastApi } from "../lib/api/dast.api";
import { usersApi } from "../lib/api/users.api";
import { useApiError } from "../hooks/use-api-error";
import { Breadcrumb } from "../components/ui/navigation";
import { Button, LinkButton } from "../components/ui/button";
import { Field } from "../components/ui/field";
import { Input } from "../components/ui/input";
import { Alert } from "../components/ui/alert";
import { Dialog, DialogDescription, DialogTitle } from "../components/ui/dialog";
import { Badge, StatusBadge } from "../components/ui/badge";
import { EmptyState, ErrorState } from "../components/ui/empty-state";
import { Skeleton } from "../components/ui/card";
import { Progress } from "../components/ui/progress";
import { DastStatusBanner, useDastStatus } from "../components/dast/dast-status-banner";
import { ACTIVE_DAST_STATUSES, labelDaFase, type DastScan } from "../types/dast.types";

function formatDuration(ms: number | null): string {
  if (ms == null) return "—";
  const totalSeconds = Math.round(ms / 1000);
  const min = Math.floor(totalSeconds / 60);
  const sec = totalSeconds % 60;
  return min > 0 ? `${min}min ${sec}s` : `${sec}s`;
}

/**
 * Célula de status: badge sempre; barra de progresso enquanto o scan está
 * vivo; selo "simulado" quando o resultado veio do gerador de demonstração.
 */
function StatusCell({ scan, posicaoNaFila }: { scan: DastScan; posicaoNaFila: number | null }) {
  const ativo = ACTIVE_DAST_STATUSES.includes(scan.status);

  return (
    <div className="flex min-w-52 flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={scan.status} />
        {scan.simulated && (
          <Badge tom="atencao" title="Resultado gerado sem executar o OWASP ZAP">
            simulado
          </Badge>
        )}
      </div>
      {ativo && (
        <>
          <Progress
            valor={scan.progress}
            rotulo={`Progresso do scan de ${scan.targetUrl}`}
            textoDoValor={`${scan.progress}% — ${labelDaFase(scan.phase)}`}
            mostrarValor
          />
          <span className="text-xs text-fg-muted">
            {posicaoNaFila && posicaoNaFila > 0 ? `Na fila — posição ${posicaoNaFila}` : labelDaFase(scan.phase)}
          </span>
        </>
      )}
    </div>
  );
}

function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function DastPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [targetUrl, setTargetUrl] = useState("");
  const [mode, setMode] = useState<"REAL" | "SIMULATED">("SIMULATED");
  const [confirmingReal, setConfirmingReal] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const closeCreate = () => { setIsCreateOpen(false); setConfirmingReal(false); setAuthorized(false); setFormError(null); };
  const [formError, setFormError] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const getErrorMessage = useApiError();

  const scansQuery = useQuery({
    queryKey: ["dast", "scans"],
    queryFn: dastApi.list,
    // 3s (era 5s): com barra de progresso na lista, 5s faz a barra andar aos
    // saltos — o runner atualiza o percentual a cada ~3s.
    refetchInterval: (query) =>
      query.state.data?.some((s) => ACTIVE_DAST_STATUSES.includes(s.status)) ? 3000 : false,
  });

  const statusQuery = useDastStatus();
  const posicaoNaFilaPorScan = useMemo(() => {
    const map = new Map<string, number>();
    statusQuery.data?.queued.forEach((q) => map.set(q.scanId, q.position));
    return map;
  }, [statusQuery.data]);

  // GET /users já vem escopado pelo backend: PENTESTER só recebe a si mesmo
  // (que é exatamente quem aparece nos próprios scans), ADMIN recebe todos —
  // então resolve nome pra QUALQUER requestedById sem lógica extra aqui.
  const usersQuery = useQuery({ queryKey: ["users"], queryFn: usersApi.list });
  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    usersQuery.data?.forEach((u) => map.set(u.id, u.name));
    return map;
  }, [usersQuery.data]);

  const createMutation = useMutation({
    mutationFn: () => dastApi.create({ targetUrl: targetUrl.trim(), mode, confirmedRealScan: mode === "REAL" && confirmingReal && authorized }),
    onSuccess: (scan) => {
      queryClient.invalidateQueries({ queryKey: ["dast", "scans"] });
      queryClient.invalidateQueries({ queryKey: ["dast", "status"] });
      closeCreate();
      setTargetUrl("");
      setFormError(null);
      // Leva direto pro acompanhamento. Quem acabou de disparar um scan quer
      // ver ele andar — antes, a pessoa voltava pra lista e tinha de caçar a
      // linha certa (a URL aparece truncada ali) pra clicar em "Ver".
      navigate(`/dast/scans/${scan.id}`);
    },
    onError: (err: unknown) => setFormError(getErrorMessage(err)),
  });

  const trimmedUrl = targetUrl.trim();
  const canSubmit = isValidHttpUrl(trimmedUrl);
  const scans = scansQuery.data ?? [];

  return (
    <div>
      <Breadcrumb itens={[{ rotulo: "DAST" }]} />

      <div data-ops-hero="dast" className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="mb-2 font-mono text-xs uppercase tracking-[0.14em] text-accent-ink">Análise de segurança</p>
          <h1 className="text-2xl font-bold text-fg">Scans DAST</h1>
          <p className="mt-1 text-fg-muted">Análise dinâmica automatizada via OWASP ZAP.</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>Novo scan</Button>
      </div>

      <DastStatusBanner status={statusQuery.data} />

      {scansQuery.isLoading && (
        <div className="mt-6 flex flex-col gap-2" aria-busy="true">
          <span className="sr-only">Carregando scans</span>
          <Skeleton className="h-12 w-full bg-inset" />
          <Skeleton className="h-12 w-full bg-inset" />
          <Skeleton className="h-12 w-full bg-inset" />
        </div>
      )}

      {scansQuery.isError && (
        <ErrorState
          className="mt-6"
          titulo="Não foi possível carregar os scans"
          descricao="A API não respondeu. Tente novamente em instantes."
          aoTentarNovamente={() => scansQuery.refetch()}
        />
      )}

      {!scansQuery.isLoading && !scansQuery.isError && scans.length === 0 && (
        <EmptyState
          className="mt-6"
          titulo="Nenhum scan ainda"
          descricao="Escolha uma demonstração sem acessar o alvo ou uma análise passiva real pelo OWASP ZAP."
          acao={<Button onClick={() => setIsCreateOpen(true)}>Novo scan</Button>}
        />
      )}

      {!scansQuery.isLoading && !scansQuery.isError && scans.length > 0 && (
        <div data-ops-surface className="mt-4 overflow-x-auto rounded-container border border-subtle">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface text-fg-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Alvo</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Solicitado por</th>
                <th className="px-4 py-3 font-medium">Alto</th>
                <th className="px-4 py-3 font-medium">Médio</th>
                <th className="px-4 py-3 font-medium">Baixo</th>
                <th className="px-4 py-3 font-medium">Info</th>
                <th className="px-4 py-3 font-medium">Duração</th>
                <th className="px-4 py-3 font-medium">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {scans.map((scan) => (
                <tr key={scan.id} className="border-t border-subtle transition-colors duration-fast hover:bg-hovered">
                  <td className="max-w-xs truncate px-4 py-3 font-mono text-xs text-fg" title={scan.targetUrl}>
                    {scan.targetUrl}
                  </td>
                  <td className="px-4 py-3">
                    <StatusCell scan={scan} posicaoNaFila={posicaoNaFilaPorScan.get(scan.id) ?? null} />
                  </td>
                  <td className="px-4 py-3 text-fg-muted">{nameById.get(scan.requestedById) ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-severity-high-ink" data-numeric>
                    {scan.alertsHigh}
                  </td>
                  <td className="px-4 py-3 font-mono text-severity-medium-ink" data-numeric>
                    {scan.alertsMedium}
                  </td>
                  <td className="px-4 py-3 font-mono text-severity-low-ink" data-numeric>
                    {scan.alertsLow}
                  </td>
                  <td className="px-4 py-3 font-mono text-fg-muted" data-numeric>
                    {scan.alertsInfo}
                  </td>
                  <td className="px-4 py-3 text-fg-muted">{formatDuration(scan.durationMs)}</td>
                  <td className="px-4 py-3">
                    <LinkButton variant="secundario" size="sm" to={`/dast/scans/${scan.id}`}>
                      Ver
                    </LinkButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog
        aberto={isCreateOpen}
        aoFechar={() => { if (!createMutation.isPending) closeCreate(); }}
      >
        <>
          <DialogTitle>{confirmingReal ? "Confirmar scan real" : "Novo scan DAST"}</DialogTitle>
          <DialogDescription>
            {confirmingReal
              ? "Este scan acessará o alvo de verdade. Confirme somente se você tem autorização para testar este endereço."
              : "Escolha como deseja executar. A demonstração gera um relatório fictício; o modo real analisa respostas do alvo com o OWASP ZAP."}
          </DialogDescription>

          <form
            className="mt-4 flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              setFormError(null);
              if (!canSubmit || createMutation.isPending) return;
              if (mode === "REAL" && !confirmingReal) { setAuthorized(false); setConfirmingReal(true); return; }
              if (mode === "REAL" && !authorized) return;
              createMutation.mutate();
            }}
          >
            {formError && <Alert tom="perigo">{formError}</Alert>}

            {confirmingReal ? (
              <>
                <Alert tom="atencao" titulo="O alvo receberá requisições reais">
                  <p className="break-all font-mono text-xs">{trimmedUrl}</p>
                  <p className="mt-2">O ZAP analisará até 30 páginas com GET no mesmo endereço e caminho, sem enviar formulários ou executar testes ativos. A navegação pode ter efeitos em aplicações mal projetadas. Não é uma análise completa de exploração.</p>
                </Alert>
                <label className="flex items-start gap-3 text-sm text-fg">
                  <input type="checkbox" checked={authorized} disabled={createMutation.isPending} onChange={(e) => setAuthorized(e.target.checked)} className="mt-1" />
                  Tenho autorização para testar este alvo e confirmo a execução real.
                </label>
              </>
            ) : (
              <>
                <fieldset className="flex flex-col gap-3" disabled={createMutation.isPending}>
                  <legend className="mb-2 text-sm font-medium text-fg">Tipo de execução</legend>
                  <label className="flex items-start gap-3 rounded-control border border-subtle bg-surface p-3 text-sm text-fg">
                    <input type="radio" name="scan-mode" value="SIMULATED" checked={mode === "SIMULATED"} onChange={() => setMode("SIMULATED")} className="mt-1" />
                    <span><strong>Simulado</strong><span className="block text-fg-muted">Relatório de demonstração. Não executa o ZAP nem acessa o alvo.</span></span>
                  </label>
                  <label className="flex items-start gap-3 rounded-control border border-subtle bg-surface p-3 text-sm text-fg">
                    <input type="radio" name="scan-mode" value="REAL" checked={mode === "REAL"} onChange={() => setMode("REAL")} className="mt-1" />
                    <span><strong>Real — análise passiva</strong><span className="block text-fg-muted">Requisições GET limitadas e achados reais do OWASP ZAP. Exige confirmação.</span></span>
                  </label>
                </fieldset>
            <Field
              rotulo="URL do alvo"
              dica="Ex: https://exemplo.com"
              obrigatorio
              erro={trimmedUrl.length > 0 && !canSubmit ? "Informe uma URL http:// ou https:// válida." : null}
            >
              {(attrs) => (
                <Input
                  {...attrs}
                  placeholder="https://exemplo.com"
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  autoFocus
                />
              )}
            </Field>

              </>
            )}

            <div className="mt-2 flex justify-end gap-2">
              <Button type="button" variant="secundario" disabled={createMutation.isPending} onClick={() => confirmingReal ? setConfirmingReal(false) : closeCreate()}>
                {confirmingReal ? "Voltar" : "Cancelar"}
              </Button>
              <Button type="submit" disabled={!canSubmit || createMutation.isPending || (confirmingReal && !authorized)}>
                {createMutation.isPending ? "Iniciando..." : confirmingReal ? "Confirmar e iniciar scan real" : mode === "REAL" ? "Continuar para confirmação" : "Gerar demonstração"}
              </Button>
            </div>
          </form>
        </>
      </Dialog>
    </div>
  );
}
