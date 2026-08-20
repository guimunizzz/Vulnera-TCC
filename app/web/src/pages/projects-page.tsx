import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { projectsApi } from "../lib/api/projects.api";
import { applicationsApi } from "../lib/api/applications.api";
import { StatusBadge } from "../components/ui/badge";
import { useAuthStore } from "../store/auth.store";

export function ProjectsPage() {
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.user?.role);

  const { data: projects, isLoading } = useQuery({ queryKey: ["projects"], queryFn: projectsApi.list });
  const { data: applications } = useQuery({
    queryKey: ["applications"],
    queryFn: applicationsApi.list,
    enabled: role !== "PENTESTER",
  });

  const applicationName = (id: string): string => applications?.find((a) => a.id === id)?.name ?? "—";

  return (
    <div>
      <h1 className="text-2xl font-bold text-fg">Projetos</h1>
      <p className="mt-1 text-fg-muted">Análises de segurança em andamento e concluídas.</p>

      {isLoading && <p className="mt-6 text-fg-muted">Carregando...</p>}
      {!isLoading && projects?.length === 0 && <p className="mt-6 text-fg-muted">Nenhum projeto ainda.</p>}

      {!isLoading && projects && projects.length > 0 && (
        <div className="mt-6 overflow-hidden rounded-container border border-subtle">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface text-fg-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Projeto</th>
                <th className="px-4 py-3 font-medium">Aplicação</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Solicitado em</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr
                  key={project.id}
                  onClick={() => navigate(`/projects/${project.id}`)}
                  className="cursor-pointer border-t border-subtle hover:bg-surface"
                >
                  <td className="px-4 py-3 text-fg">{project.name}</td>
                  <td className="px-4 py-3 text-fg-muted">{applicationName(project.applicationId)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={project.status} />
                  </td>
                  <td className="px-4 py-3 text-fg-muted">
                    {new Date(project.requestedAt).toLocaleDateString("pt-BR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
