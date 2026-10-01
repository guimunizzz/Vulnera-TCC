import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { applicationsApi } from "../lib/api/applications.api";
import { companiesApi } from "../lib/api/companies.api";
import { subscriptionsApi } from "../lib/api/subscriptions.api";
import { plansApi } from "../lib/api/plans.api";
import { getApiErrorCode, useApiError } from "../hooks/use-api-error";
import { useAuthStore } from "../store/auth.store";
import { useCompanyName } from "../hooks/use-company-name";
import { Breadcrumb, ScrollArea } from "../components/ui/navigation";
import { Button, LinkButton } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, Label, RegiaoCarregando, Skeleton } from "../components/ui/card";
import { CLASSES_CONTROLE } from "../components/ui/field";
import { ErrorState } from "../components/ui/empty-state";
import { Alert } from "../components/ui/alert";
import { Dialog, DialogDescription, DialogTitle } from "../components/ui/dialog";
import { RiskContextChips } from "../components/applications/risk-context-chips";
import { ApplicationRiskForm } from "../components/applications/application-risk-form";
import { StaggerItem, StaggerList } from "../motion/components";
import type { Application, CreateApplicationInput } from "../types/application.types";
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
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const createFormSession = useRef(0);
  const createInFlight = useRef<number | null>(null);

  const role = useAuthStore((s) => s.user?.role);
  const getErrorMessage = useApiError();
  const queryClient = useQueryClient();
  const companyName = useCompanyName(undefined);

  const { data: applications, isLoading, isError, refetch } = useQuery({ queryKey: ["applications"], queryFn: applicationsApi.list });
  const companiesQuery = useQuery({
    queryKey: ["companies"],
    queryFn: companiesApi.list,
    enabled: role === "ADMIN",
    retry: false,
    networkMode: "always",
  });
  const { data: currentSubscription } = useQuery({
    queryKey: ["subscriptions", "current"],
    queryFn: subscriptionsApi.current,
    enabled: role === "CLIENT",
    retry: false,
  });
  const { data: plans } = useQuery({
    queryKey: ["plans"],
    queryFn: plansApi.list,
    enabled: role === "CLIENT",
  });
  const currentPlan = role === "CLIENT" ? plans?.find((p) => p.id === currentSubscription?.planId) : undefined;

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
    setSelectedCompanyId("");
    setFormError(null);
  }

  function closeCreateDialog(): void {
    createFormSession.current += 1;
    setIsCreateOpen(false);
    resetForm();
  }

  function openCreateDialog(): void {
    createFormSession.current += 1;
    resetForm();
    setIsCreateOpen(true);
  }

  const createMutation = useMutation({
    mutationFn: ({ input }: { input: CreateApplicationInput; formSession: number }) => applicationsApi.create(input),
    onSuccess: (_created, variables) => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      if (variables.formSession !== createFormSession.current) return;
      closeCreateDialog();
    },
    onError: (err: unknown, variables) => {
      const code = getApiErrorCode(err);
      if (code === "COMPANY_NOT_FOUND" && role === "ADMIN") {
        void queryClient.invalidateQueries({ queryKey: ["companies"] });
        if (variables.formSession !== createFormSession.current) return;
        setSelectedCompanyId("");
        setFormError("A empresa selecionada não está mais disponível. Atualizamos a lista; escolha outra empresa.");
        return;
      }
      if (variables.formSession !== createFormSession.current) return;

      if (role === "ADMIN" && code === "NO_ACTIVE_SUBSCRIPTION") {
        setFormError("A empresa selecionada não tem uma assinatura ativa, necessária para cadastrar aplicações.");
      } else if (role === "ADMIN" && code === "PLAN_LIMIT_REACHED") {
        setFormError("A empresa selecionada atingiu o limite de aplicações do plano ativo.");
      } else if (code === "PLAN_LIMIT_REACHED" && role === "CLIENT" && currentPlan) {
        setFormError(
          `Limite de ${currentPlan.maxApplications} aplicações do plano ${currentPlan.name} atingido. ` +
            "Remova uma aplicação existente ou fale com o admin sobre um upgrade de plano.",
        );
      } else {
        setFormError(getErrorMessage(err));
      }
    },
    onSettled: (_created, _error, variables) => {
      if (createInFlight.current === variables.formSession) createInFlight.current = null;
    },
  });

  const companies = companiesQuery.data ?? [];
  const selectedCompanyExists = companies.some((company) => company.id === selectedCompanyId);
  const companyUnavailable =
    role === "ADMIN" &&
    (companiesQuery.isLoading || companiesQuery.isFetching || companiesQuery.isError || companies.length === 0 || !selectedCompanyExists);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => applicationsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      setDeleteTarget(null);
    },
  });

  const totalAplicacoes = applications?.length ?? 0;
  const limiteAplicacoes = role === "CLIENT" ? currentPlan?.maxApplications : undefined;
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
                {role === "CLIENT" && currentPlan
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
        {role !== "PENTESTER" && <Button onClick={openCreateDialog} className="shrink-0">Nova aplicação</Button>}
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
          {role !== "PENTESTER" && !filter && <Button onClick={openCreateDialog}>Nova aplicação</Button>}
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
                        <LinkButton
                          variant="secundario"
                          size="sm"
                          to={`/new-analysis?applicationId=${application.id}`}
                          state={{ returnTo: "/applications" }}
                        >
                          Nova análise
                        </LinkButton>
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

      <Dialog aberto={isCreateOpen} aoFechar={closeCreateDialog}>
        <>
          <DialogTitle>Nova aplicação</DialogTitle>
          <DialogDescription>Cadastre o alvo que será analisado.</DialogDescription>

          <form
            className="mt-4 flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (createMutation.isPending || createInFlight.current !== null) return;

              let companyId: string | undefined;
              if (role === "ADMIN") {
                if (companiesQuery.isLoading || companiesQuery.isFetching) {
                  setFormError("Aguarde o carregamento das empresas antes de continuar.");
                  return;
                }
                if (companiesQuery.isError) {
                  setFormError("Não foi possível carregar as empresas. Tente novamente.");
                  return;
                }
                if (companies.length === 0) {
                  setFormError("Nenhuma empresa cadastrada. Cadastre uma empresa antes de criar uma aplicação.");
                  return;
                }
                if (!selectedCompanyId || !selectedCompanyExists) {
                  setFormError("Selecione a empresa da aplicação.");
                  return;
                }
                companyId = selectedCompanyId;
              }

              setFormError(null);
              const formSession = createFormSession.current;
              createInFlight.current = formSession;
              createMutation.mutate({
                input: {
                  name,
                  url: url.trim() || undefined,
                  description: description.trim() || undefined,
                  ...(role === "ADMIN" && companyId ? { companyId } : {}),
                },
                formSession,
              });
            }}
          >
            {formError && <Alert>{formError}</Alert>}

            {role === "ADMIN" && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="app-company">Empresa <span aria-hidden="true" className="text-danger-ink">*</span></Label>
                <select
                  id="app-company"
                  required
                  aria-required="true"
                  value={selectedCompanyId}
                  onChange={(e) => setSelectedCompanyId(e.target.value)}
                  disabled={
                    createMutation.isPending || companiesQuery.isLoading || companiesQuery.isFetching ||
                    companiesQuery.isError || companies.length === 0
                  }
                  className={`${CLASSES_CONTROLE} h-10`}
                >
                  <option value="" disabled>
                    {companiesQuery.isLoading || companiesQuery.isFetching
                      ? "Carregando empresas…"
                      : companiesQuery.isError
                        ? "Lista indisponível"
                        : companies.length === 0
                          ? "Nenhuma empresa disponível"
                          : "Selecione uma empresa"}
                  </option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>{company.name}</option>
                  ))}
                </select>
                {companiesQuery.isLoading && (
                  <p role="status" className="text-sm text-fg-muted">Carregando empresas…</p>
                )}
                {companiesQuery.isError && (
                  <div className="flex flex-col items-start gap-2">
                    <Alert tom="perigo">Não foi possível carregar as empresas.</Alert>
                    <Button
                      type="button"
                      variant="secundario"
                      onClick={() => void companiesQuery.refetch()}
                      disabled={companiesQuery.isFetching}
                    >
                      {companiesQuery.isFetching ? "Carregando…" : "Tentar novamente"}
                    </Button>
                  </div>
                )}
                {!companiesQuery.isLoading && !companiesQuery.isError && companies.length === 0 && (
                  <Alert tom="atencao">
                    Nenhuma empresa cadastrada. Cadastre uma empresa antes de criar uma aplicação.
                  </Alert>
                )}
              </div>
            )}

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
              <Button type="button" variant="secundario" onClick={closeCreateDialog}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending || companyUnavailable}>
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
