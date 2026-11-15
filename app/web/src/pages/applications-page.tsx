import { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Monitor, MoreHorizontal, Plus, Search } from "lucide-react";
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
import { DropdownMenu, type ItemDeMenu } from "../components/ui/dropdown-menu";
import { Badge } from "../components/ui/badge";
import { RiskContextChips } from "../components/applications/risk-context-chips";
import { ApplicationRiskForm } from "../components/applications/application-risk-form";
import { StaggerItem, StaggerList } from "../motion/components";
import { ENVIRONMENTS, ENVIRONMENT_LABELS, type Application, type CreateApplicationInput, type Environment } from "../types/application.types";
import "./applications-page.css";
import { TABELA } from "../components/ui/table-estilos";

export function ApplicationsPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Application | null>(null);
  // Contexto de risco (CP-1): qual app está com o formulário aberto.
  const [contextTarget, setContextTarget] = useState<Application | null>(null);
  const [filter, setFilter] = useState("");
  // Filtro só no navegador, sobre a lista já carregada (regra da Fase 5).
  const [ambiente, setAmbiente] = useState<Environment | "">("");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const createFormSession = useRef(0);
  const createInFlight = useRef<number | null>(null);

  const role = useAuthStore((s) => s.user?.role);
  const navigate = useNavigate();
  const getErrorMessage = useApiError();
  const queryClient = useQueryClient();
  const companyName = useCompanyName(undefined);

  const { data: applications, isLoading, isError, refetch } = useQuery({ queryKey: ["applications"], queryFn: applicationsApi.list });
  const companiesQuery = useQuery({
    queryKey: ["companies"],
    queryFn: companiesApi.list,
    enabled: role === "ADMIN",
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
    return applications.filter(
      (a) =>
        (!ambiente || a.environment === ambiente) &&
        (!term || a.name.toLowerCase().includes(term) || Boolean(a.url?.toLowerCase().includes(term))),
    );
  }, [applications, filter, ambiente]);

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

  const filtrosAtivos = Boolean(filter.trim()) || ambiente !== "";

  function limparFiltros(): void {
    setFilter("");
    setAmbiente("");
  }

  function acoesDaLinha(application: Application): ItemDeMenu[] {
    const itens: ItemDeMenu[] = [
      { id: "painel", rotulo: "Abrir painel", aoEscolher: () => navigate(`/applications/${application.id}/dashboard`) },
    ];
    if (role !== "PENTESTER") {
      itens.push(
        { id: "contexto", rotulo: "Editar contexto de risco", aoEscolher: () => setContextTarget(application) },
        { id: "remover", rotulo: "Remover aplicação", destrutivo: true, aoEscolher: () => setDeleteTarget(application) },
      );
    }
    return itens;
  }

  return (
    <div className="applications-workspace flex flex-col gap-6">
      <header className="atmosfera-veu flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 max-w-2xl">
          <Breadcrumb itens={[{ rotulo: companyName ?? "Empresa" }, { rotulo: "Aplicações" }]} />
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-accent-ink">Inventário de superfície</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight text-fg">Aplicações</h1>
            {applications && (
              <Badge tom="neutro" className="whitespace-nowrap">
                <span data-numeric>{totalAplicacoes}</span> {totalAplicacoes === 1 ? "aplicação" : "aplicações"}
              </Badge>
            )}
          </div>
          <p className="mt-2 text-sm text-fg-secondary">
            Organize os alvos que serão analisados e mantenha o contexto de risco ao alcance da equipe.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-4 sm:justify-end">
          {ocupacao !== null && currentPlan && (
            <div className="min-w-[11rem]">
              <p className="text-xs text-fg-muted">
                Plano {currentPlan.name}: {Math.min(totalAplicacoes, currentPlan.maxApplications)} de {currentPlan.maxApplications} vagas
              </p>
              <div
                role="progressbar"
                aria-label="Capacidade de aplicações do plano"
                aria-valuemin={0}
                aria-valuemax={limiteAplicacoes}
                aria-valuenow={Math.min(totalAplicacoes, limiteAplicacoes ?? 0)}
                className="applications-capacity-track mt-2"
              >
                <span className="applications-capacity-fill" style={{ width: `${ocupacao}%` }} />
              </div>
            </div>
          )}
          {role !== "PENTESTER" && (
            <Button onClick={openCreateDialog} className="shrink-0" iconeInicio={<Plus className="h-4 w-4" aria-hidden="true" />}>
              Nova aplicação
            </Button>
          )}
        </div>
      </header>

      {isLoading && <ApplicationsLoading />}

      {!isLoading && isError && (
        <ErrorState
          titulo="Não foi possível carregar as aplicações"
          aoTentarNovamente={() => void refetch()}
        />
      )}

      {!isLoading && !isError && totalAplicacoes === 0 && (
        <Card titulo="Nenhuma aplicação encontrada" descricao="Cadastre o primeiro alvo que será analisado.">
          {role !== "PENTESTER" && <Button onClick={openCreateDialog}>Nova aplicação</Button>}
        </Card>
      )}

      {!isLoading && !isError && totalAplicacoes > 0 && (
        <section aria-label="Aplicações registradas" className="overflow-hidden rounded-container border border-subtle bg-surface shadow-raised">
          <div className="flex flex-col gap-3 border-b border-subtle p-4 sm:flex-row sm:items-center">
            <div className="w-full sm:max-w-xs">
              <Label htmlFor="application-filter" className="sr-only">Filtrar aplicações</Label>
              <Input
                id="application-filter"
                type="search"
                placeholder="Buscar por nome ou URL…"
                prefixo={<Search className="h-4 w-4" aria-hidden="true" />}
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </div>
            <div className="w-full sm:w-auto">
              <Label htmlFor="application-environment" className="sr-only">Filtrar por ambiente</Label>
              <select
                id="application-environment"
                value={ambiente}
                onChange={(e) => setAmbiente(e.target.value as Environment | "")}
                className={`${CLASSES_CONTROLE} h-10`}
              >
                <option value="">Todos os ambientes</option>
                {ENVIRONMENTS.map((env) => (
                  <option key={env} value={env}>{ENVIRONMENT_LABELS[env]}</option>
                ))}
              </select>
            </div>
            <p className="text-xs text-fg-muted sm:ml-auto" aria-live="polite">
              {filtered.length} {filtered.length === 1 ? "aplicação encontrada" : "aplicações encontradas"}
            </p>
          </div>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-start gap-3 p-6">
              <p className="text-sm font-medium text-fg">Nenhuma aplicação com esses filtros</p>
              <p className="text-sm text-fg-muted">Ajuste a busca ou o ambiente para procurar outro alvo.</p>
              <Button variant="secundario" size="sm" onClick={limparFiltros}>Limpar filtros</Button>
            </div>
          ) : (
            <ScrollArea rotulo="Tabela de aplicações" className="applications-inventory-table">
              <table className="min-w-[56rem] w-full text-left text-sm">
                <thead className={TABELA.cabecalho}>
                  <tr>
                    <th className="px-4 py-3 font-medium">Aplicação</th>
                    <th className="px-4 py-3 font-medium">Ambiente</th>
                    <th className="px-4 py-3 font-medium">Contexto de risco</th>
                    <th className="px-4 py-3 font-medium"><span className="sr-only">Ações</span></th>
                  </tr>
                </thead>
                <StaggerList as="tbody">
                  {filtered.map((application, index) => (
                    <StaggerItem as="tr" indice={index} key={application.id} className={`${TABELA.linha} align-middle`}>
                      <td className="px-4 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-control border border-subtle bg-inset text-fg-muted">
                            <Monitor className="h-4 w-4" />
                          </span>
                          <div className="min-w-0">
                            <Link
                              to={`/applications/${application.id}/dashboard`}
                              className="font-medium text-fg underline-offset-2 hover:text-accent-ink hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                            >
                              {application.name}
                            </Link>
                            <p className="mt-1 max-w-[18rem] truncate text-xs text-fg-muted" title={application.url ?? undefined}>
                              {application.url ?? "Sem URL cadastrada"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tom={application.environment === "PROD" ? "acento" : "neutro"} className="whitespace-nowrap">
                          {ENVIRONMENT_LABELS[application.environment as Environment] ?? application.environment}
                        </Badge>
                      </td>
                      <td className="px-4 py-3"><RiskContextChips contexto={application} mostrarAmbiente={false} /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <LinkButton
                            variant="secundario"
                            size="sm"
                            to={`/new-analysis?applicationId=${application.id}`}
                            state={{ returnTo: "/applications" }}
                          >
                            Nova análise
                          </LinkButton>
                          <DropdownMenu
                            rotulo={`Mais ações para ${application.name}`}
                            gatilho={
                              <Button variant="fantasma" size="sm" aria-label={`Mais ações para ${application.name}`}>
                                <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                              </Button>
                            }
                            itens={acoesDaLinha(application)}
                          />
                        </div>
                      </td>
                    </StaggerItem>
                  ))}
                </StaggerList>
              </table>
            </ScrollArea>
          )}

          <div className="flex flex-col gap-2 border-t border-subtle px-4 py-3 text-xs text-fg-muted sm:flex-row sm:items-center sm:justify-between">
            <p>
              Mostrando <span className="font-semibold text-fg-secondary" data-numeric>{filtered.length}</span> de{" "}
              <span className="font-semibold text-fg-secondary" data-numeric>{totalAplicacoes}</span>{" "}
              {totalAplicacoes === 1 ? "aplicação" : "aplicações"}
              {filtrosAtivos && (
                <>
                  {" · "}
                  <button type="button" onClick={limparFiltros} className="font-medium text-accent-ink underline-offset-2 hover:underline">
                    limpar filtros
                  </button>
                </>
              )}
            </p>
            <p>Selecione o nome para abrir o painel da aplicação.</p>
          </div>
        </section>
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
              <div className="flex flex-col gap-2">
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

            <div className="flex flex-col gap-2">
              <Label htmlFor="app-name">Nome</Label>
              <Input id="app-name" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="app-url">URL</Label>
              <Input
                id="app-url"
                placeholder="https://exemplo.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
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
        <div className="border-b border-subtle bg-inset px-4 py-3"><Skeleton className="h-3 w-[18rem]" /></div>
        <div className="flex flex-col gap-0">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="grid grid-cols-[1.1fr_1.4fr_2fr] gap-4 border-b border-subtle px-4 py-5 last:border-0">
              <Skeleton className="h-4 w-[8rem]" />
              <Skeleton className="h-4 w-[12rem]" />
              <Skeleton className="h-6 w-[13rem]" />
            </div>
          ))}
        </div>
      </Card>
    </RegiaoCarregando>
  );
}
