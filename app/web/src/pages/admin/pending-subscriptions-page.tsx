import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { subscriptionsApi } from "../../lib/api/subscriptions.api";
import { companiesApi } from "../../lib/api/companies.api";
import { plansApi } from "../../lib/api/plans.api";
import { useApiError } from "../../hooks/use-api-error";
import { Button } from "../../components/ui/button";
import { Alert } from "../../components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../../components/ui/dialog";
import type { Subscription } from "../../types/subscription.types";

type PendingAction = { subscription: Subscription; type: "approve" | "reject" } | null;

export function PendingSubscriptionsPage() {
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [error, setError] = useState<string | null>(null);
  const getErrorMessage = useApiError();
  const queryClient = useQueryClient();

  const { data: subscriptions, isLoading } = useQuery({
    queryKey: ["subscriptions", "pending"],
    queryFn: subscriptionsApi.listPending,
  });
  const { data: companies } = useQuery({ queryKey: ["companies"], queryFn: companiesApi.list });
  const { data: plans } = useQuery({ queryKey: ["plans"], queryFn: plansApi.list });

  const companyName = (id: string): string => companies?.find((c) => c.id === id)?.name ?? id;
  const planName = (id: string): string => plans?.find((p) => p.id === id)?.name ?? id;

  function invalidate(): void {
    queryClient.invalidateQueries({ queryKey: ["subscriptions", "pending"] });
    setPendingAction(null);
  }

  const approveMutation = useMutation({
    mutationFn: (id: string) => subscriptionsApi.approve(id),
    onSuccess: invalidate,
    onError: (err) => setError(getErrorMessage(err)),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => subscriptionsApi.reject(id),
    onSuccess: invalidate,
    onError: (err) => setError(getErrorMessage(err)),
  });

  const isMutating = approveMutation.isPending || rejectMutation.isPending;

  function confirmAction(): void {
    if (!pendingAction) return;
    setError(null);
    if (pendingAction.type === "approve") approveMutation.mutate(pendingAction.subscription.id);
    else rejectMutation.mutate(pendingAction.subscription.id);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">Assinaturas pendentes</h1>
      <p className="mt-1 text-muted">Aprove ou recuse os pedidos de assinatura das empresas.</p>

      {error && <Alert className="mt-4">{error}</Alert>}

      {isLoading && <p className="mt-6 text-muted">Carregando...</p>}

      {!isLoading && subscriptions?.length === 0 && (
        <p className="mt-6 text-muted">Nenhuma assinatura pendente no momento.</p>
      )}

      {!isLoading && subscriptions && subscriptions.length > 0 && (
        <div className="mt-6 overflow-hidden rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Empresa</th>
                <th className="px-4 py-3 font-medium">Plano</th>
                <th className="px-4 py-3 font-medium">Solicitado em</th>
                <th className="px-4 py-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.map((sub) => (
                <tr key={sub.id} className="border-t border-border">
                  <td className="px-4 py-3 text-foreground">{companyName(sub.companyId)}</td>
                  <td className="px-4 py-3 text-foreground">{planName(sub.planId)}</td>
                  <td className="px-4 py-3 text-muted">{new Date(sub.createdAt).toLocaleString("pt-BR")}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => setPendingAction({ subscription: sub, type: "approve" })}
                      >
                        Aprovar
                      </Button>
                      <Button variant="danger" onClick={() => setPendingAction({ subscription: sub, type: "reject" })}>
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

      <Dialog open={pendingAction !== null} onOpenChange={(open) => !open && setPendingAction(null)}>
        <DialogContent>
          <DialogTitle>{pendingAction?.type === "approve" ? "Aprovar assinatura?" : "Recusar assinatura?"}</DialogTitle>
          <DialogDescription>
            {pendingAction?.type === "approve"
              ? "A empresa passará a ter uma assinatura ativa imediatamente."
              : "O pedido de assinatura será recusado."}
          </DialogDescription>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setPendingAction(null)} disabled={isMutating}>
              Cancelar
            </Button>
            <Button
              variant={pendingAction?.type === "approve" ? "primary" : "danger"}
              onClick={confirmAction}
              disabled={isMutating}
            >
              {isMutating ? "Processando..." : "Confirmar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
