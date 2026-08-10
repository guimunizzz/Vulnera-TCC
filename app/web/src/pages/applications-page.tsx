import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { applicationsApi } from "../lib/api/applications.api";
import { subscriptionsApi } from "../lib/api/subscriptions.api";
import { plansApi } from "../lib/api/plans.api";
import { getApiErrorCode, useApiError } from "../hooks/use-api-error";
import { useAuthStore } from "../store/auth.store";
import { useCompanyName } from "../hooks/use-company-name";
import { Breadcrumb } from "../components/ui/navigation";
import { Button, LinkButton } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/card";
import { Alert } from "../components/ui/alert";
import { Dialog, DialogDescription, DialogTitle } from "../components/ui/dialog";
import type { Application } from "../types/application.types";

export function ApplicationsPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Application | null>(null);
  const [filter, setFilter] = useState("");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const role = useAuthStore((s) => s.user?.role);
  const getErrorMessage = useApiError();
  const queryClient = useQueryClient();
  const companyName = useCompanyName(undefined);

  const { data: applications, isLoading } = useQuery({ queryKey: ["applications"], queryFn: applicationsApi.list });
  const { data: currentSubscription } = useQuery({
    queryKey: ["subscriptions", "current"],
    queryFn: subscriptionsApi.current,
    retry: false,
  });
  const { data: plans } = useQuery({ queryKey: ["plans"], queryFn: plansApi.list });
  const currentPlan = plans?.find((p) => p.id === currentSubscription?.planId);

  const filtered = useMemo(() => {
    if (!applications) return [];
    const term = filter.trim().toLowerCase();
    if (!term) return applications;
    return applications.filter(
      (a) => a.name.toLowerCase().includes(term) || a.url?.toLowerCase().includes(term),
    );
  }, [applications, filter]);

  function resetForm(): void {
    setName("");
    setUrl("");
    setDescription("");
    setFormError(null);
  }

  const createMutation = useMutation({
    mutationFn: () =>
      applicationsApi.create({ name, url: url.trim() || undefined, description: description.trim() || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      setIsCreateOpen(false);
      resetForm();
    },
    onError: (err: unknown) => {
      const code = getApiErrorCode(err);
      if (code === "PLAN_LIMIT_REACHED" && currentPlan) {
        setFormError(
          `Limite de ${currentPlan.maxApplications} aplicações do plano ${currentPlan.name} atingido. ` +
            "Remova uma aplicação existente ou fale com o admin sobre um upgrade de plano.",
        );
      } else {
        setFormError(getErrorMessage(err));
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => applicationsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      setDeleteTarget(null);
    },
  });

  return (
    <div>
      <Breadcrumb itens={[{ rotulo: companyName ?? "Empresa" }, { rotulo: "Aplicações" }]} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-fg">Aplicações</h1>
          <p className="mt-1 text-fg-muted">
            {currentPlan
              ? `${applications?.length ?? 0}/${currentPlan.maxApplications} aplicações do plano ${currentPlan.name}`
              : "Cadastre as aplicações que serão analisadas."}
          </p>
        </div>
        {role !== "PENTESTER" && <Button onClick={() => setIsCreateOpen(true)}>Nova aplicação</Button>}
      </div>

      <Input
        placeholder="Filtrar por nome ou URL..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="mt-6 max-w-sm"
      />

      {isLoading && <p className="mt-6 text-fg-muted">Carregando...</p>}

      {!isLoading && filtered.length === 0 && (
        <p className="mt-6 text-fg-muted">Nenhuma aplicação encontrada.</p>
      )}

      {!isLoading && filtered.length > 0 && (
        <div className="mt-4 overflow-hidden rounded-container border border-subtle">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface text-fg-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">URL</th>
                <th className="px-4 py-3 font-medium">Ambiente</th>
                <th className="px-4 py-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((application) => (
                <tr key={application.id} className="border-t border-subtle">
                  <td className="px-4 py-3 text-fg">{application.name}</td>
                  <td className="px-4 py-3 text-fg-muted">{application.url ?? "—"}</td>
                  <td className="px-4 py-3 text-fg-muted">{application.environment}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <LinkButton variant="secundario" size="sm" to={`/applications/${application.id}/dashboard`}>
                        Painel
                      </LinkButton>
                      <LinkButton variant="secundario" size="sm" to={`/new-analysis?applicationId=${application.id}`}>
                        Nova análise
                      </LinkButton>
                      {role !== "PENTESTER" && (
                        <Button variant="destrutivo" onClick={() => setDeleteTarget(application)}>
                          Remover
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog aberto={isCreateOpen} aoFechar={() => { setIsCreateOpen(false); resetForm(); }}>
        <>
          <DialogTitle>Nova aplicação</DialogTitle>
          <DialogDescription>Cadastre o alvo que será analisado.</DialogDescription>

          <form
            className="mt-4 flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              setFormError(null);
              createMutation.mutate();
            }}
          >
            {formError && <Alert>{formError}</Alert>}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="app-name">Nome</Label>
              <Input id="app-name" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="app-url">URL</Label>
              <Input
                id="app-url"
                placeholder="https://exemplo.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="app-description">Descrição</Label>
              <Input id="app-description" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>

            <div className="mt-2 flex justify-end gap-2">
              <Button type="button" variant="secundario" onClick={() => setIsCreateOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Criando..." : "Criar"}
              </Button>
            </div>
          </form>
        </>
      </Dialog>

      <Dialog aberto={deleteTarget !== null} aoFechar={() => setDeleteTarget(null)}>
        <>
          <DialogTitle>Remover aplicação?</DialogTitle>
          <DialogDescription>
            &quot;{deleteTarget?.name}&quot; deixará de aparecer na lista. Isso libera uma vaga no limite do plano.
          </DialogDescription>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="secundario" onClick={() => setDeleteTarget(null)} disabled={deleteMutation.isPending}>
              Cancelar
            </Button>
            <Button
              variant="destrutivo"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Removendo..." : "Remover"}
            </Button>
          </div>
        </>
      </Dialog>
    </div>
  );
}
