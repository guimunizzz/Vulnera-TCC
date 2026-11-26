/**
 * filas-page.tsx
 *
 * Página "Filas" do ADMIN (ADR-056): para cada fila de execução, quantos jobs
 * estão esperando, rodando, agendados, concluídos e com falha, e as últimas
 * falhas com o botão "Tentar de novo". Atualiza sozinha a cada 10 s.
 *
 * Com o motor em memória (QUEUE_DRIVER=memory) não existe fila persistente:
 * a tela explica isso em vez de mostrar zeros que pareceriam saudáveis.
 * Só ADMIN; a API recusa os outros papéis com 403.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queueAdminApi } from "../../lib/api/queue-admin.api";
import { Breadcrumb } from "../../components/ui/navigation";
import { Button } from "../../components/ui/button";
import { Alert } from "../../components/ui/alert";
import { Card, Skeleton } from "../../components/ui/card";
import { EmptyState, ErrorState } from "../../components/ui/empty-state";
import { useToast } from "../../components/ui/toast";
import { useApiError } from "../../hooks/use-api-error";
import type { ContagensFila, FilaPainel, JobFalhoPainel } from "../../types/queue-admin.types";

const INTERVALO_ATUALIZACAO_MS = 10_000;

const CONTAGENS: { chave: keyof ContagensFila; rotulo: string }[] = [
  { chave: "waiting", rotulo: "Esperando" },
  { chave: "active", rotulo: "Rodando" },
  { chave: "delayed", rotulo: "Agendados" },
  { chave: "completed", rotulo: "Concluídos" },
  { chave: "failed", rotulo: "Com falha" },
];

function formatarQuando(iso: string | null): string {
  if (!iso) return "sem data";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "medium" });
}

function CartaoFila({ fila }: { fila: FilaPainel }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const getErrorMessage = useApiError();

  const reprocessar = useMutation({
    mutationFn: (job: JobFalhoPainel) => queueAdminApi.reprocessar(fila.name, job.id),
    onSuccess: (_resultado, job) => {
      toast.sucesso("Job reenfileirado", `${fila.label} · job ${job.id}`);
      queryClient.invalidateQueries({ queryKey: ["admin-queues"] });
    },
    onError: (err: unknown) => toast.erro("Não foi possível tentar de novo", getErrorMessage(err)),
  });

  return (
    <Card titulo={fila.label} descricao={<span className="font-mono">{fila.name}</span>}>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {CONTAGENS.map(({ chave, rotulo }) => (
          <div key={chave} className="flex flex-col gap-1 rounded-control bg-inset p-3">
            <dt className="text-xs text-fg-muted">{rotulo}</dt>
            <dd
              className={
                chave === "failed" && fila.counts.failed > 0
                  ? "font-mono text-xl font-bold text-danger"
                  : "font-mono text-xl font-bold text-fg"
              }
              data-numeric
            >
              {fila.counts[chave]}
            </dd>
          </div>
        ))}
      </dl>

      <h3 className="mb-3 mt-6 text-sm font-semibold text-fg">Falhas recentes</h3>
      {fila.failed.length === 0 ? (
        <p className="text-sm text-fg-muted">Nenhuma falha recente nesta fila.</p>
      ) : (
        <ul className="flex flex-col gap-3" aria-label={`Falhas recentes de ${fila.label}`}>
          {fila.failed.map((job) => {
            const reenviando = reprocessar.isPending && reprocessar.variables?.id === job.id;
            return (
              <li
                key={job.id}
                className="flex flex-col gap-3 rounded-control border border-subtle p-3 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <p className="break-words text-sm font-medium text-fg">{job.failedReason || "Sem motivo registrado"}</p>
                  <p className="text-xs text-fg-muted">
                    Tentativas: {job.attemptsMade} · {formatarQuando(job.finishedOn)} · job {job.id}
                  </p>
                  <details className="text-xs text-fg-muted">
                    <summary className="cursor-pointer">Dados do job</summary>
                    <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all rounded-control bg-inset p-2 font-mono">{job.data}</pre>
                  </details>
                </div>
                {fila.name === "dast-scan" ? (
                  // Scan DAST com falha já está FAILED no banco: reprocessar o job não rodaria nada.
                  <p className="max-w-xs text-xs text-fg-muted">Para tentar de novo, dispare um scan novo na tela de DAST.</p>
                ) : (
                  <Button variant="secundario" size="sm" carregando={reenviando} onClick={() => reprocessar.mutate(job)}>
                    Tentar de novo
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

export function FilasPage() {
  const painel = useQuery({
    queryKey: ["admin-queues"],
    queryFn: () => queueAdminApi.painel(),
    refetchInterval: INTERVALO_ATUALIZACAO_MS,
  });

  return (
    <div>
      <Breadcrumb itens={[{ rotulo: "Administração" }, { rotulo: "Filas" }]} />

      <div className="mt-2 flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-fg">Filas</h1>
        <p className="max-w-2xl text-fg-muted">
          Acompanhe as filas de execução do Vulnera: o que está esperando, rodando, agendado, concluído e com falha. A tela
          atualiza sozinha a cada 10 segundos.
        </p>
      </div>

      {painel.isLoading && (
        <div className="mt-6 flex flex-col gap-4" aria-busy="true">
          <span className="sr-only">Carregando filas</span>
          <Skeleton className="h-[12rem] w-full bg-inset" />
          <Skeleton className="h-[12rem] w-full bg-inset" />
        </div>
      )}

      {painel.isError && (
        <ErrorState
          className="mt-6"
          titulo="Não foi possível carregar as filas"
          descricao="A API não respondeu. Tente novamente em instantes."
          aoTentarNovamente={() => painel.refetch()}
        />
      )}

      {painel.isSuccess && painel.data.driver === "memory" && (
        <Alert tom="info" titulo="Motor de filas em memória" className="mt-6">
          <p>
            Esta instância roda com QUEUE_DRIVER=memory: os jobs vivem na memória do processo e não há fila persistente para
            mostrar. Para acompanhar e reprocessar falhas, suba a API com QUEUE_DRIVER=bullmq e o Redis configurado.
          </p>
        </Alert>
      )}

      {painel.isSuccess && painel.data.driver === "bullmq" && painel.data.queues.length === 0 && (
        <EmptyState
          className="mt-6"
          titulo="Nenhuma fila encontrada"
          descricao="A API respondeu sem filas. Confira a configuração do worker."
        />
      )}

      {painel.isSuccess && painel.data.driver === "bullmq" && painel.data.queues.length > 0 && (
        <div className="mt-6 grid gap-4">
          {painel.data.queues.map((fila) => (
            <CartaoFila key={fila.name} fila={fila} />
          ))}
        </div>
      )}
    </div>
  );
}
