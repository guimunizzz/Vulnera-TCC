/**
 * O que faz: apresenta solicitações comerciais pendentes na central administrativa.
 * Por que existe: preserva a aprovação de assinaturas legadas sem repetir a decisão de adesões.
 * Quem consome: seção comercial da Central de solicitações, exclusiva de ADMIN.
 */
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { subscriptionsApi } from "../../lib/api/subscriptions.api";
import { companiesApi } from "../../lib/api/companies.api";
import { plansApi } from "../../lib/api/plans.api";
import { useApiError } from "../../hooks/use-api-error";
import { Button } from "../../components/ui/button";
import { Alert } from "../../components/ui/alert";
import { Dialog, DialogDescription, DialogTitle } from "../../components/ui/dialog";
import type { Subscription } from "../../types/subscription.types";
import { useAuthStore } from "../../store/auth.store";
import { TABELA } from "../../components/ui/table-estilos";

type PendingAction = { subscription: Subscription; type: "approve" | "reject" } | null;

export function PendingSubscriptionsPage() {
  const isAdmin = useAuthStore((state) => state.user?.role === "ADMIN");
  const inFlight = useRef(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [error, setError] = useState<string | null>(null);
  const getErrorMessage = useApiError();
  const queryClient = useQueryClient();

  const { data: subscriptions, isLoading, isError, refetch } = useQuery({
    queryKey: ["subscriptions", "pending"],
    queryFn: subscriptionsApi.listPending,
    enabled: isAdmin,
  });
  const { data: companies } = useQuery({ queryKey: ["companies"], queryFn: companiesApi.list, enabled: isAdmin });
  const { data: plans } = useQuery({ queryKey: ["plans"], queryFn: plansApi.list, enabled: isAdmin });

  const companyName = (id: string): string => companies?.find((c) => c.id === id)?.name ?? id;
  const planName = (id: string): string => plans?.find((p) => p.id === id)?.name ?? id;

  function invalidate(): void {
    queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
    setPendingAction(null);
  }

  const approveMutation = useMutation({
    mutationFn: (id: string) => subscriptionsApi.approve(id),
    onSuccess: invalidate,
    onError: (err) => setError(getErrorMessage(err)),
    onSettled: () => { inFlight.current = false; },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => subscriptionsApi.reject(id),
    onSuccess: invalidate,
    onError: (err) => setError(getErrorMessage(err)),
    onSettled: () => { inFlight.current = false; },
  });

  const isMutating = approveMutation.isPending || rejectMutation.isPending;

  function confirmAction(): void {
    if (!isAdmin || !pendingAction || inFlight.current || pendingAction.subscription.status !== "PENDING_APPROVAL") return;
    inFlight.current = true;
    setError(null);
    if (pendingAction.type === "approve") approveMutation.mutate(pendingAction.subscription.id);
    else rejectMutation.mutate(pendingAction.subscription.id);
  }

  if (!isAdmin) return <Alert tom="perigo">Acesso restrito a administradores.</Alert>;

  return (
    <section className="access-requests-panel" aria-labelledby="commercial-requests-title">
      <header className="access-requests-panel-heading">
        <h2 id="commercial-requests-title">Solicitações comerciais</h2>
        <p>Revise assinaturas legadas e operações comerciais pendentes. Novas adesões são aprovadas na seção Adesões empresariais.</p>
      </header>

      {error && <Alert className="mt-4" tom="perigo">{error}</Alert>}

      {isLoading && <p role="status" className="mt-6 text-fg-muted">Carregando solicitações comerciais…</p>}

      {isError && <div className="access-requests-state"><p>Não foi possível carregar as solicitações comerciais.</p><Button variant="secundario" onClick={() => void refetch()}>Tentar novamente</Button></div>}

      {!isLoading && !isError && subscriptions?.length === 0 && (
        <p className="mt-6 text-fg-muted">Nenhuma assinatura pendente no momento.</p>
      )}

      {!isLoading && subscriptions && subscriptions.length > 0 && (
        <div className="mt-6 overflow-x-auto rounded-container border border-subtle">
          <table className="min-w-[40rem] w-full text-left text-sm">
            <caption className="sr-only">Solicitações de assinatura aguardando decisão comercial</caption>
            <thead className={TABELA.cabecalho}>
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Empresa</th>
                <th scope="col" className="px-4 py-3 font-medium">Plano</th>
                <th scope="col" className="px-4 py-3 font-medium">Solicitado em</th>
                <th scope="col" className="px-4 py-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.map((sub) => (
                <tr key={sub.id} className={TABELA.linha}>
                  <td className="px-4 py-3 text-fg">{companyName(sub.companyId)}</td>
                  <td className="px-4 py-3 text-fg">{planName(sub.planId)}</td>
                  <td className="px-4 py-3 text-fg-muted">{new Date(sub.createdAt).toLocaleString("pt-BR")}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Button
                        variant="secundario"
                        disabled={isMutating}
                        onClick={() => setPendingAction({ subscription: sub, type: "approve" })}
                      >
                        Aprovar
                      </Button>
                      <Button variant="destrutivo" disabled={isMutating} onClick={() => setPendingAction({ subscription: sub, type: "reject" })}>
                        Recusar
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog aberto={pendingAction !== null} aoFechar={() => { if (!isMutating) setPendingAction(null); }}>
        <>
          <DialogTitle>{pendingAction?.type === "approve" ? "Aprovar assinatura?" : "Recusar assinatura?"}</DialogTitle>
          <DialogDescription>
            {pendingAction?.type === "approve"
              ? "A empresa passará a ter uma assinatura ativa imediatamente."
              : "O pedido de assinatura será recusado."}
          </DialogDescription>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="secundario" onClick={() => setPendingAction(null)} disabled={isMutating}>
              Cancelar
            </Button>
            <Button
              variant={pendingAction?.type === "approve" ? "primario" : "destrutivo"}
              onClick={confirmAction}
              disabled={isMutating}
            >
              {isMutating ? "Processando..." : "Confirmar"}
            </Button>
          </div>
        </>
      </Dialog>
    </section>
  );
}
