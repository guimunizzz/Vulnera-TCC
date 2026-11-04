/**
 * projects-page.tsx
 *
 * O QUE FAZ: apresenta o portfólio e sua distribuição pelos estados reais.
 * POR QUE EXISTE: dá contexto de andamento sem esconder o acesso ao detalhe.
 * QUEM CONSOME: rota autenticada `/projects`.
 *
 * Refactor web-motion-3d (Fase 5): cabeçalho compacto; os cards de estado
 * filtram a tabela; busca e filtro de status agem só sobre a lista já
 * carregada (nenhuma consulta nova); a etapa atual ganha uma barra de quatro
 * passos derivada do próprio status.
 */

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowRight, Plus, Search } from "lucide-react";
import { projectsApi } from "../lib/api/projects.api";
import { applicationsApi } from "../lib/api/applications.api";
import { Badge, StatusBadge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, Label, RegiaoCarregando, Skeleton } from "../components/ui/card";
import { CLASSES_CONTROLE } from "../components/ui/field";
import { Input } from "../components/ui/input";
import { EmptyState, ErrorState } from "../components/ui/empty-state";
import { LinkButton } from "../components/ui/button";
import { Breadcrumb, ScrollArea } from "../components/ui/navigation";
import { StaggerItem, StaggerList } from "../motion/components";
import { useAuthStore } from "../store/auth.store";
import { useCompanyName } from "../hooks/use-company-name";
import { cn } from "../lib/cn";
import type { ProjectStatus } from "../types/project.types";
import "./projects-page.css";
import { TABELA } from "../components/ui/table-estilos";

const STATUS_STEPS: { status: ProjectStatus; label: string }[] = [
  { status: "PENDING", label: "Pendentes" },
  { status: "IN_PROGRESS", label: "Em andamento" },
  { status: "IN_REVIEW", label: "Em revisão" },
  { status: "COMPLETED", label: "Concluídos" },
];

const ETAPA: Record<ProjectStatus, number> = { PENDING: 1, IN_PROGRESS: 2, IN_REVIEW: 3, COMPLETED: 4 };

const DATA = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

export function ProjectsPage() {
  const role = useAuthStore((s) => s.user?.role);
  const canCreateProject = role === "ADMIN" || role === "CLIENT";
  const companyName = useCompanyName(undefined);
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState<ProjectStatus | "">("");
  const { data: projects, isLoading, isError, refetch } = useQuery({
    queryKey: ["projects"], queryFn: projectsApi.list,
  });
  const { data: applications } = useQuery({
    queryKey: ["applications"], queryFn: applicationsApi.list, enabled: role !== "PENTESTER",
  });

  const applicationNames = useMemo(
    () => new Map(applications?.map((application) => [application.id, application.name])),
    [applications],
  );
  const totalProjects = projects?.length ?? 0;

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (projects ?? []).filter((project) =>
      (!status || project.status === status) &&
      (!termo ||
        project.name.toLowerCase().includes(termo) ||
        Boolean(applicationNames.get(project.applicationId)?.toLowerCase().includes(termo))),
    );
  }, [projects, busca, status, applicationNames]);

  const filtrosAtivos = Boolean(busca.trim()) || status !== "";
  function limparFiltros(): void {
    setBusca("");
    setStatus("");
  }

  const novoProjeto = canCreateProject ? (
    <LinkButton to="/new-analysis" state={{ returnTo: "/projects" }} size="md" iconeInicio={<Plus className="h-4 w-4" aria-hidden="true" />}>
      Novo projeto
    </LinkButton>
  ) : null;

  return (
    <div className="projects-workspace flex flex-col gap-6">
      <header className="atmosfera-veu flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 max-w-2xl">
          <Breadcrumb itens={[{ rotulo: companyName ?? "Empresa" }, { rotulo: "Projetos" }]} />
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-accent-ink">Portfólio de análises</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight text-fg">Projetos</h1>
            {projects && (
              <Badge tom="neutro" className="whitespace-nowrap">
                <span data-numeric>{totalProjects}</span> {totalProjects === 1 ? "projeto" : "projetos"}
              </Badge>
            )}
          </div>
          <p className="mt-2 text-sm text-fg-secondary">
            Acompanhe cada análise de segurança, do pedido à entrega, em um só lugar.
          </p>
        </div>
        {novoProjeto && <div className="shrink-0">{novoProjeto}</div>}
      </header>

      <section aria-label="Fluxo dos projetos">
        <ul className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {STATUS_STEPS.map(({ status: estado, label }) => {
            const ativo = status === estado;
            return (
              <li key={estado}>
                <button
                  type="button"
                  aria-pressed={ativo}
                  disabled={!projects}
                  onClick={() => setStatus(ativo ? "" : estado)}
                  className={cn(
                    `projects-flow-step projects-flow-step--${estado.toLowerCase()} group flex w-full flex-col gap-3 rounded-container border bg-surface p-4 text-left shadow-raised transition-colors duration-fast`,
                    "hover:border-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-default",
                    ativo ? "border-accent" : "border-subtle",
                  )}
                >
                  <span className="flex items-center gap-2 text-sm text-fg-secondary">
                    <span aria-hidden="true" className="projects-flow-dot" />
                    {label}
                  </span>
                  <span className="flex items-end justify-between gap-3">
                    <span className="font-mono text-2xl font-semibold text-fg" data-numeric>
                      {projects ? projects.filter((project) => project.status === estado).length : "—"}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-fg-muted group-hover:text-accent-ink">
                      {ativo ? "Mostrar todos" : "Ver projetos"}
                      <ArrowRight className="h-3 w-3" aria-hidden="true" />
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {isLoading && <ProjectsLoading />}
      {!isLoading && isError && (
        <ErrorState titulo="Não foi possível carregar os projetos" aoTentarNovamente={() => void refetch()} />
      )}
      {!isLoading && !isError && totalProjects === 0 && (
        <EmptyState
          titulo="Nenhum projeto ainda"
          descricao={canCreateProject
            ? "Quando uma análise for solicitada, você poderá acompanhar o andamento aqui."
            : "Os projetos atribuídos a você aparecerão aqui para acompanhamento."}
          acao={canCreateProject ? (
            <LinkButton to="/new-analysis" state={{ returnTo: "/projects" }} size="sm">
              Novo projeto
            </LinkButton>
          ) : undefined}
        />
      )}
      {!isLoading && !isError && totalProjects > 0 && (
        <section aria-label="Projetos registrados" className="overflow-hidden rounded-container border border-subtle bg-surface shadow-raised">
          <div className="flex flex-col gap-3 border-b border-subtle p-4 sm:flex-row sm:items-center">
            <div className="w-full sm:max-w-xs">
              <Label htmlFor="project-filter" className="sr-only">Buscar projeto ou aplicação</Label>
              <Input
                id="project-filter"
                type="search"
                placeholder="Buscar projeto ou aplicação…"
                prefixo={<Search className="h-4 w-4" aria-hidden="true" />}
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
            <div className="w-full sm:w-auto">
              <Label htmlFor="project-status" className="sr-only">Filtrar por status</Label>
              <select
                id="project-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as ProjectStatus | "")}
                className={`${CLASSES_CONTROLE} h-10`}
              >
                <option value="">Todos os status</option>
                {STATUS_STEPS.map(({ status: estado, label }) => (
                  <option key={estado} value={estado}>{label}</option>
                ))}
              </select>
            </div>
            <p className="text-xs text-fg-muted sm:ml-auto" aria-live="polite">
              {filtrados.length} {filtrados.length === 1 ? "projeto encontrado" : "projetos encontrados"}
            </p>
          </div>

          {filtrados.length === 0 ? (
            <div className="flex flex-col items-start gap-3 p-6">
              <p className="text-sm font-medium text-fg">Nenhum projeto com esses filtros</p>
              <p className="text-sm text-fg-muted">Ajuste a busca ou o status para encontrar outra análise.</p>
              <Button variant="secundario" size="sm" onClick={limparFiltros}>Limpar filtros</Button>
            </div>
          ) : (
            <ScrollArea rotulo="Tabela de projetos" className="projects-table">
              <table className="min-w-[48rem] w-full text-left text-sm">
                <thead className={TABELA.cabecalho}>
                  <tr>
                    <th className="px-4 py-3 font-medium">Projeto</th>
                    <th className="px-4 py-3 font-medium">Aplicação</th>
                    <th className="px-4 py-3 font-medium">Etapa atual</th>
                    <th className="px-4 py-3 font-medium">Solicitado em</th>
                    <th className="px-4 py-3"><span className="sr-only">Abrir</span></th>
                  </tr>
                </thead>
                <StaggerList as="tbody">
                  {filtrados.map((project, index) => (
                    <StaggerItem as="tr" indice={index} key={project.id} className={`projects-row relative align-middle ${TABELA.linha}`}>
                      <td className="px-4 py-3 font-medium text-fg">
                        {/* O link cobre a linha inteira (::after) — a seta é só a pista visual. */}
                        <Link className="projects-row-link rounded-control text-fg hover:text-accent-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" to={`/projects/${project.id}`}>
                          {project.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-fg-muted">{applicationNames.get(project.applicationId) ?? "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-start gap-2">
                          <StatusBadge status={project.status} />
                          <span
                            className={`projects-etapas projects-flow-step--${project.status.toLowerCase()}`}
                            aria-label={`Etapa ${ETAPA[project.status]} de 4`}
                            role="img"
                          >
                            {[1, 2, 3, 4].map((passo) => (
                              <span key={passo} data-feito={passo <= ETAPA[project.status] ? "true" : undefined} />
                            ))}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-fg-muted">
                        <time dateTime={project.requestedAt}>{DATA.format(new Date(project.requestedAt))}</time>
                      </td>
                      <td className="px-4 py-3 text-right text-fg-muted">
                        <ArrowRight className="projects-row-arrow ml-auto h-4 w-4" aria-hidden="true" />
                      </td>
                    </StaggerItem>
                  ))}
                </StaggerList>
              </table>
            </ScrollArea>
          )}

          <div className="flex flex-col gap-2 border-t border-subtle px-4 py-3 text-xs text-fg-muted sm:flex-row sm:items-center sm:justify-between">
            <p>
              Mostrando <span className="font-semibold text-fg-secondary" data-numeric>{filtrados.length}</span> de{" "}
              <span className="font-semibold text-fg-secondary" data-numeric>{totalProjects}</span>{" "}
              {totalProjects === 1 ? "projeto" : "projetos"}
              {filtrosAtivos && (
                <>
                  {" · "}
                  <button type="button" onClick={limparFiltros} className="font-medium text-accent-ink underline-offset-2 hover:underline">
                    limpar filtros
                  </button>
                </>
              )}
            </p>
            <p>As etapas representam o status da análise.</p>
          </div>
        </section>
      )}
    </div>
  );
}

function ProjectsLoading() {
  return (
    <RegiaoCarregando rotulo="Carregando projetos">
      <Card semPadding className="overflow-hidden">
        <div className="border-b border-subtle bg-inset px-4 py-3"><Skeleton className="h-3 w-1/3" /></div>
        {[0, 1, 2].map((item) => (
          <div key={item} className="grid grid-cols-3 gap-4 border-b border-subtle px-4 py-5 last:border-0">
            <Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-2/3" /><Skeleton className="h-6 w-1/2" />
          </div>
        ))}
      </Card>
    </RegiaoCarregando>
  );
}
