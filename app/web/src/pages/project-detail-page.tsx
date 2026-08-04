import { useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { projectsApi } from "../lib/api/projects.api";
import { applicationsApi } from "../lib/api/applications.api";
import { projectMembersApi } from "../lib/api/project-members.api";
import { usersApi } from "../lib/api/users.api";
import { useApiError } from "../hooks/use-api-error";
import { useAuthStore } from "../store/auth.store";
import { useCompanyName } from "../hooks/use-company-name";
import { Breadcrumb } from "../components/layout/breadcrumb";
import { StatusBadge } from "../components/ui/status-badge";
import { Button } from "../components/ui/button";
import { Alert } from "../components/ui/alert";
import { cn } from "../lib/cn";
import type { ProjectStatus } from "../types/project.types";

const ALLOWED_TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
  PENDING: ["IN_PROGRESS"],
  IN_PROGRESS: ["IN_REVIEW"],
  IN_REVIEW: ["COMPLETED", "IN_PROGRESS"],
  COMPLETED: [],
};

const TRANSITION_LABELS: Partial<Record<ProjectStatus, Partial<Record<ProjectStatus, string>>>> = {
  PENDING: { IN_PROGRESS: "Iniciar análise" },
  IN_PROGRESS: { IN_REVIEW: "Enviar para revisão" },
  IN_REVIEW: { COMPLETED: "Concluir projeto", IN_PROGRESS: "Voltar para andamento" },
};

const ANALYSIS_LEVEL_LABELS: Record<string, string> = {
  BASIC: "Básico",
  INTERMEDIATE: "Intermediário",
  ADVANCED: "Avançado",
};

type Tab = "overview" | "findings" | "reports";

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>("overview");
  const [error, setError] = useState<string | null>(null);
  const [selectedPentesterId, setSelectedPentesterId] = useState("");

  const role = useAuthStore((s) => s.user?.role);
  const getErrorMessage = useApiError();
  const queryClient = useQueryClient();

  const { data: project, isLoading } = useQuery({
    queryKey: ["projects", id],
    queryFn: () => projectsApi.getById(id!),
    enabled: !!id,
  });

  const { data: application } = useQuery({
    queryKey: ["applications", project?.applicationId],
    queryFn: () => applicationsApi.getById(project!.applicationId),
    enabled: !!project?.applicationId && role !== "PENTESTER",
  });

  const { data: members } = useQuery({
    queryKey: ["projects", id, "members"],
    queryFn: () => projectMembersApi.list(id!),
    enabled: !!id,
  });

  const { data: users } = useQuery({
    queryKey: ["users"],
    queryFn: usersApi.list,
    enabled: role === "ADMIN",
  });

  const companyName = useCompanyName(project?.companyId);

  const userName = (userId: string): string => users?.find((u) => u.id === userId)?.name ?? userId;
  const pentesterCandidates = (users ?? []).filter(
    (u) => u.role === "PENTESTER" && !members?.some((m) => m.userId === u.id),
  );

  const transitionMutation = useMutation({
    mutationFn: (toStatus: ProjectStatus) => projectsApi.transition(id!, toStatus),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects", id] });
      setError(null);
    },
    onError: (err: unknown) => setError(getErrorMessage(err)),
  });

  const addMemberMutation = useMutation({
    mutationFn: (userId: string) => projectMembersApi.add(id!, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects", id, "members"] });
      setSelectedPentesterId("");
      setError(null);
    },
    onError: (err: unknown) => setError(getErrorMessage(err)),
  });

  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) => projectMembersApi.remove(id!, userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects", id, "members"] }),
    onError: (err: unknown) => setError(getErrorMessage(err)),
  });

  if (isLoading || !project) {
    return <p className="text-muted">Carregando...</p>;
  }

  const transitions = ALLOWED_TRANSITIONS[project.status];
  const canTransition = role !== "CLIENT";

  return (
    <div>
      <Breadcrumb
        items={[
          { label: companyName ?? "Empresa" },
          { label: application?.name ?? "Aplicação" },
          { label: project.name },
        ]}
      />

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">{project.name}</h1>
            <StatusBadge status={project.status} />
          </div>
          <p className="mt-1 text-muted">
            {project.analysisType} · {ANALYSIS_LEVEL_LABELS[project.analysisLevel] ?? project.analysisLevel}
          </p>
        </div>

        {canTransition && transitions.length > 0 && (
          <div className="flex gap-2">
            {transitions.map((toStatus) => (
              <Button
                key={toStatus}
                variant={toStatus === "IN_PROGRESS" && project.status === "IN_REVIEW" ? "secondary" : "primary"}
                onClick={() => transitionMutation.mutate(toStatus)}
                disabled={transitionMutation.isPending}
              >
                {TRANSITION_LABELS[project.status]?.[toStatus] ?? toStatus}
              </Button>
            ))}
          </div>
        )}
      </div>

      {error && <Alert className="mt-4">{error}</Alert>}

      <div className="mt-6 flex gap-1 border-b border-border">
        {(["overview", "findings", "reports"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "border-b-2 border-transparent px-4 py-2 text-sm text-muted transition-colors hover:text-foreground",
              tab === t && "border-accent text-foreground",
            )}
          >
            {t === "overview" ? "Visão geral" : t === "findings" ? "Findings" : "Relatórios"}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div className="rounded-lg border border-border p-4">
            <h2 className="mb-3 font-semibold text-foreground">Metadados</h2>
            <dl className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">Remediação incluída</dt>
                <dd className="text-foreground">{project.hasRemediation ? "Sim" : "Não"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Solicitado em</dt>
                <dd className="text-foreground">{new Date(project.requestedAt).toLocaleDateString("pt-BR")}</dd>
              </div>
              {project.startedAt && (
                <div className="flex justify-between">
                  <dt className="text-muted">Iniciado em</dt>
                  <dd className="text-foreground">{new Date(project.startedAt).toLocaleDateString("pt-BR")}</dd>
                </div>
              )}
              {project.closedAt && (
                <div className="flex justify-between">
                  <dt className="text-muted">Concluído em</dt>
                  <dd className="text-foreground">{new Date(project.closedAt).toLocaleDateString("pt-BR")}</dd>
                </div>
              )}
              {project.scopeIn && (
                <div>
                  <dt className="text-muted">Escopo</dt>
                  <dd className="text-foreground">{project.scopeIn}</dd>
                </div>
              )}
              {project.scopeOut && (
                <div>
                  <dt className="text-muted">Fora de escopo</dt>
                  <dd className="text-foreground">{project.scopeOut}</dd>
                </div>
              )}
            </dl>
          </div>

          <div className="rounded-lg border border-border p-4">
            <h2 className="mb-3 font-semibold text-foreground">Pentesters atribuídos</h2>

            {members?.length === 0 && <p className="text-sm text-muted">Nenhum pentester atribuído ainda.</p>}

            <ul className="flex flex-col gap-2">
              {members?.map((member) => (
                <li key={member.id} className="flex items-center justify-between rounded-md bg-surface px-3 py-2 text-sm">
                  <span className="text-foreground">{userName(member.userId)}</span>
                  {role === "ADMIN" && (
                    <button
                      onClick={() => removeMemberMutation.mutate(member.userId)}
                      className="text-severity-critical hover:underline"
                    >
                      Remover
                    </button>
                  )}
                </li>
              ))}
            </ul>

            {role === "ADMIN" && (
              <div className="mt-4 flex gap-2">
                <select
                  value={selectedPentesterId}
                  onChange={(e) => setSelectedPentesterId(e.target.value)}
                  className="flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground"
                >
                  <option value="">Selecione um pentester...</option>
                  {pentesterCandidates.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
                <Button
                  variant="secondary"
                  disabled={!selectedPentesterId || addMemberMutation.isPending}
                  onClick={() => addMemberMutation.mutate(selectedPentesterId)}
                >
                  Adicionar
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "findings" && (
        <div className="mt-6 rounded-lg border border-border p-8 text-center text-muted">
          Disponível na Fase 5 — Findings.
        </div>
      )}

      {tab === "reports" && (
        <div className="mt-6 rounded-lg border border-border p-8 text-center text-muted">
          Disponível na Fase 6 — Relatórios.
        </div>
      )}
    </div>
  );
}
