import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { applicationsApi } from "../lib/api/applications.api";
import { subscriptionsApi } from "../lib/api/subscriptions.api";
import { plansApi } from "../lib/api/plans.api";
import { getApiErrorCode, useApiError } from "../hooks/use-api-error";
import { useAuthStore } from "../store/auth.store";
import { useCompanyName } from "../hooks/use-company-name";
import { Breadcrumb, ScrollArea } from "../components/ui/navigation";
import { Button, LinkButton } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, Label, RegiaoCarregando, Skeleton } from "../components/ui/card";
import { ErrorState } from "../components/ui/empty-state";
import { Alert } from "../components/ui/alert";
import { Dialog, DialogDescription, DialogTitle } from "../components/ui/dialog";
import { RiskContextChips } from "../components/applications/risk-context-chips";
import { ApplicationRiskForm } from "../components/applications/application-risk-form";
import { StaggerItem, StaggerList } from "../motion/components";
import type { Application } from "../types/application.types";
import "./applications-page.css";

export function ApplicationsPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Application | null>(null);
  // Contexto de risco (CP-1): qual app está com o formulário aberto.
  const [contextTarget, setContextTarget] = useState<Application | null>(null);
  const [filter, setFilter] = useState("");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const role = useAuthStore((s) => s.user?.role);
  const getErrorMessage = useApiError();
  const queryClient = useQueryClient();
  const companyName = useCompanyName(undefined);

  const { data: applications, isLoading, isError, refetch } = useQuery({ queryKey: ["applications"], queryFn: applicationsApi.list });
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

  const totalAplicacoes = applications?.length ?? 0;
  const limiteAplicacoes = currentPlan?.maxApplications;
  const ocupacao = applications && limiteAplicacoes && limiteAplicacoes > 0
    ? Math.min(100, (totalAplicacoes / limiteAplicacoes) * 100)
    : null;

  return (
    <div className="applications-workspace flex flex-col gap-5">
      <section className="applications-hero relative overflow-hidden rounded-container border border-subtle px-5 py-5 sm:px-6">
        <div aria-hidden="true" className="applications-hero-signal pointer-events-none absolute inset-0" />
        <Breadcrumb itens={[{ rotulo: companyName ?? "Empresa" }, { rotulo: "Aplicações" }]} className="relative" />

        <div className="relative mt-5 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold tracking-[0.16em] text-accent-ink">INVENTÁRIO DE SUPERFÍCIE</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-fg">Aplicações</h1>
            <p className="mt-2 text-sm text-fg-secondary">
              Organize os alvos que serão analisados e mantenha o contexto de risco ao alcance da equipe.
            </p>
          </div>

          <div className="applications-hero-stat min-w-fit py-1 pl-4 sm:pb-0">
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-2xl font-semibold text-fg" data-numeric>{applications ? totalAplicacoes : "—"}</span>
              <span className="max-w-36 text-xs leading-5 text-fg-muted">
                {currentPlan
                  ? `de ${currentPlan.maxApplications} vagas no plano ${currentPlan.name}`
                  : "alvos registrados"}
              </span>
            </div>
            {ocupacao !== null && (
              <div
                role="progressbar"
                aria-label="Capacidade de aplicações do plano"
                aria-valuemin={0}
                aria-valuemax={limiteAplicacoes}
                aria-valuenow={Math.min(totalAplicacoes, limiteAplicacoes ?? 0)}
                className="applications-capacity-track mt-3"
              >
                <span className="applications-capacity-fill" style={{ width: `${ocupacao}%` }} />
              </div>
            )}
          </div>
        </div>
      </section>

      <section aria-label="Buscar aplicações" className="flex flex-col gap-3 rounded-container border border-subtle bg-surface p-4 shadow-raised sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full sm:max-w-sm">
          <Label htmlFor="application-filter" className="sr-only">Filtrar aplicações</Label>
          <Input
            id="application-filter"
            placeholder="Filtrar por nome ou URL..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
        <p className="text-xs text-fg-muted" aria-live="polite">
          {isLoading ? "Carregando inventário…" : isError ? "Inventário indisponível" : `${filtered.length} ${filtered.length === 1 ? "aplicação encontrada" : "aplicações encontradas"}`}
        </p>
        {role !== "PENTESTER" && <Button onClick={() => setIsCreateOpen(true)} className="shrink-0">Nova aplicação</Button>}
      </section>

      {isLoading && <ApplicationsLoading />}

      {!isLoading && isError && (
        <ErrorState
          titulo="Não foi possível carregar as aplicações"
          aoTentarNovamente={() => void refetch()}
        />
      )}

      {!isLoading && !isError && filtered.length === 0 && (
        <Card titulo="Nenhuma aplicação encontrada" descricao={filter ? "Ajuste o filtro para procurar outro alvo." : "Cadastre o primeiro alvo que será analisado."}>
          {role !== "PENTESTER" && !filter && <Button onClick={() => setIsCreateOpen(true)}>Nova aplicação</Button>}
        </Card>
      )}

      {!isLoading && !isError && filtered.length > 0 && (
        <Card
          titulo="Aplicações registradas"
          descricao="O contexto de risco acompanha cada alvo nas análises e nos findings."
          semPadding
          className="overflow-hidden"
        >
          <ScrollArea rotulo="Tabela de aplicações" className="applications-inventory-table">
            <table className="min-w-[56rem] w-full text-left text-sm">
              <thead className="border-b border-subtle bg-inset text-xs uppercase tracking-[0.1em] text-fg-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Nome</th>
                  <th className="px-4 py-3 font-medium">URL</th>
                  <th className="px-4 py-3 font-medium">Contexto de risco</th>
                  <th className="px-4 py-3 font-medium">Ações</th>
                </tr>
              </thead>
              <StaggerList as="tbody">
                {filtered.map((application, index) => (
                  <StaggerItem as="tr" indice={index} key={application.id} className="border-t border-subtle align-middle">
                    <td className="px-4 py-4 font-medium text-fg">{application.name}</td>
                    <td className="max-w-60 truncate px-4 py-4 text-fg-muted" title={application.url ?? undefined}>
                      {application.url ?? "—"}
                    </td>
                    <td className="px-4 py-4"><RiskContextChips contexto={application} /></td>
                    <td className="px-4 py-4">
                      <div className="flex min-w-[19rem] flex-wrap gap-2">
                        <LinkButton variant="secundario" size="sm" to={`/applications/${application.id}/dashboard`}>Painel</LinkButton>
                        {role !== "PENTESTER" && (
                          <Button variant="secundario" size="sm" onClick={() => setContextTarget(application)}>Contexto</Button>
                        )}
                        <LinkButton variant="secundario" size="sm" to={`/new-analysis?applicationId=${application.id}`}>Nova análise</LinkButton>
                        {role !== "PENTESTER" && (
                          <Button variant="destrutivo" size="sm" onClick={() => setDeleteTarget(application)}>Remover</Button>
                        )}
                      </div>
                    </td>
                  </StaggerItem>
                ))}
              </StaggerList>
            </table>
          </ScrollArea>
        </Card>
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

      {/* Contexto de risco (CP-1). O Dialog só monta o formulário com um alvo:
          o form usa o `application` como estado inicial e não deve nascer
          vazio para depois "trocar" de app — cada abertura é uma instância. */}
      <Dialog aberto={contextTarget !== null} aoFechar={() => setContextTarget(null)}>
        <>
          <DialogTitle>Contexto de risco — {contextTarget?.name}</DialogTitle>
          <DialogDescription>
            Onde esta aplicação está e o que ela guarda. Define a prioridade (VRS) de todos os findings dela.
          </DialogDescription>
          {contextTarget && (
            <ApplicationRiskForm
              key={contextTarget.id}
              application={contextTarget}
              aoSalvar={() => setContextTarget(null)}
              aoCancelar={() => setContextTarget(null)}
            />
          )}
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

function ApplicationsLoading() {
  return (
    <RegiaoCarregando rotulo="Carregando aplicações">
      <Card semPadding className="overflow-hidden">
        <div className="border-b border-subtle bg-inset px-4 py-3"><Skeleton className="h-3 w-72" /></div>
        <div className="flex flex-col gap-0">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="grid grid-cols-[1.1fr_1.4fr_2fr] gap-4 border-b border-subtle px-4 py-5 last:border-0">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-6 w-52" />
            </div>
          ))}
        </div>
      </Card>
    </RegiaoCarregando>
  );
}
