/**
 * projects-page.tsx
 *
 * O QUE FAZ: apresenta o portfólio e sua distribuição pelos estados reais.
 * POR QUE EXISTE: dá contexto de andamento sem esconder o acesso ao detalhe.
 * QUEM CONSOME: rota autenticada `/projects`.
 */

import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { projectsApi } from "../lib/api/projects.api";
import { applicationsApi } from "../lib/api/applications.api";
import { StatusBadge } from "../components/ui/badge";
import { Card, RegiaoCarregando, Skeleton } from "../components/ui/card";
import { EmptyState, ErrorState } from "../components/ui/empty-state";
import { LinkButton } from "../components/ui/button";
import { Breadcrumb, ScrollArea } from "../components/ui/navigation";
import { StaggerItem, StaggerList } from "../motion/components";
import { useAuthStore } from "../store/auth.store";
import { useCompanyName } from "../hooks/use-company-name";
import type { ProjectStatus } from "../types/project.types";
import "./projects-page.css";

const STATUS_STEPS: { status: ProjectStatus; label: string }[] = [
  { status: "PENDING", label: "Pendentes" },
  { status: "IN_PROGRESS", label: "Em andamento" },
  { status: "IN_REVIEW", label: "Em revisão" },
  { status: "COMPLETED", label: "Concluídos" },
];

export function ProjectsPage() {
  const role = useAuthStore((s) => s.user?.role);
  const companyName = useCompanyName(undefined);
  const { data: projects, isLoading, isError, refetch } = useQuery({
    queryKey: ["projects"], queryFn: projectsApi.list,
  });
  const { data: applications } = useQuery({
    queryKey: ["applications"], queryFn: applicationsApi.list, enabled: role !== "PENTESTER",
  });

  const applicationNames = new Map(applications?.map((application) => [application.id, application.name]));
  const totalProjects = projects?.length ?? 0;

  return (
    <div className="projects-workspace flex flex-col gap-5">
      <section className="projects-hero relative overflow-hidden rounded-container border border-subtle px-5 py-5 sm:px-6">
        <div aria-hidden="true" className="projects-hero-signal pointer-events-none absolute inset-0" />
        <Breadcrumb itens={[{ rotulo: companyName ?? "Empresa" }, { rotulo: "Projetos" }]} className="relative" />
        <div className="relative mt-5 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold tracking-[0.16em] text-accent-ink">PORTFÓLIO DE ANÁLISES</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-fg">Projetos</h1>
            <p className="mt-2 text-sm text-fg-secondary">
              Acompanhe cada análise de segurança, do pedido à entrega, em um só lugar.
            </p>
          </div>
          <div className="projects-hero-stat flex min-w-fit items-baseline gap-3 py-1 pl-4 sm:pb-0">
            <span className="font-mono text-2xl font-semibold text-fg" data-numeric>{projects ? totalProjects : "—"}</span>
            <span className="max-w-28 text-xs leading-5 text-fg-muted">
              {totalProjects === 1 ? "projeto registrado" : "projetos registrados"}
            </span>
          </div>
        </div>
      </section>

      <Card titulo="Fluxo dos projetos" descricao="Distribuição pelos estados atuais das análises." semPadding className="projects-flow-card overflow-hidden">
        <dl className="projects-flow-grid mt-4 grid grid-cols-2 sm:grid-cols-4">
          {STATUS_STEPS.map(({ status, label }) => (
            <div key={status} className={`projects-flow-step projects-flow-step--${status.toLowerCase()} px-4 py-4`}>
              <dt className="flex items-center gap-2 text-xs text-fg-muted">
                <span aria-hidden="true" className="projects-flow-dot" />{label}
              </dt>
              <dd className="mt-2 font-mono text-xl font-semibold text-fg" data-numeric>
                {projects ? projects.filter((project) => project.status === status).length : "—"}
              </dd>
            </div>
          ))}
        </dl>
      </Card>

      {isLoading && <ProjectsLoading />}
      {!isLoading && isError && (
        <ErrorState titulo="Não foi possível carregar os projetos" aoTentarNovamente={() => void refetch()} />
      )}
      {!isLoading && !isError && totalProjects === 0 && (
        <EmptyState
          titulo="Nenhum projeto ainda"
          descricao="Quando uma análise for solicitada, você poderá acompanhar o andamento aqui."
          acao={<LinkButton to="/new-analysis" size="sm">Nova análise</LinkButton>}
        />
      )}
      {!isLoading && !isError && totalProjects > 0 && (
        <Card titulo="Projetos registrados" descricao="Abra um projeto para ver escopo, equipe, findings e relatórios." semPadding className="overflow-hidden">
          <ScrollArea rotulo="Tabela de projetos" className="projects-table">
            <table className="min-w-[42rem] w-full text-left text-sm">
              <thead className="border-b border-subtle bg-inset text-xs uppercase tracking-[0.1em] text-fg-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Projeto</th>
                  <th className="px-4 py-3 font-medium">Aplicação</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Solicitado em</th>
                </tr>
              </thead>
              <StaggerList as="tbody">
                {projects?.map((project, index) => (
                  <StaggerItem as="tr" indice={index} key={project.id} className="border-t border-subtle align-middle">
                    <td className="px-4 py-4 font-medium text-fg">
                      <Link className="projects-row-link rounded-control text-fg hover:text-accent-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" to={`/projects/${project.id}`}>
                        {project.name}<span aria-hidden="true" className="projects-row-arrow">↗</span>
                      </Link>
                    </td>
                    <td className="px-4 py-4 text-fg-muted">{applicationNames.get(project.applicationId) ?? "—"}</td>
                    <td className="px-4 py-4"><StatusBadge status={project.status} /></td>
                    <td className="px-4 py-4 text-fg-muted">
                      <time dateTime={project.requestedAt}>{new Date(project.requestedAt).toLocaleDateString("pt-BR")}</time>
                    </td>
                  </StaggerItem>
                ))}
              </StaggerList>
            </table>
          </ScrollArea>
        </Card>
      )}
    </div>
  );
}

function ProjectsLoading() {
  return (
    <RegiaoCarregando rotulo="Carregando projetos">
      <Card semPadding className="overflow-hidden">
        <div className="border-b border-subtle bg-inset px-4 py-3"><Skeleton className="h-3 w-72" /></div>
        {[0, 1, 2].map((item) => (
          <div key={item} className="grid grid-cols-3 gap-4 border-b border-subtle px-4 py-5 last:border-0">
            <Skeleton className="h-4 w-32" /><Skeleton className="h-4 w-40" /><Skeleton className="h-6 w-24" />
          </div>
        ))}
      </Card>
    </RegiaoCarregando>
  );
}
