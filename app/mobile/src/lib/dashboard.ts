/** Calcula indicadores e prioridades do painel a partir dos dados reais consumidos pelo cliente. */
import type { ExposureApplication } from "../types/exposure-graph.types";
import type { Project } from "../types/project.types";

const severityOrder: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
export function projectOverview(projects: Project[]) {
  const total = projects.length;
  const completed = projects.filter((project) => project.status === "COMPLETED").length;
  return { total, completed, active: projects.filter((project) => project.status === "IN_PROGRESS" || project.status === "IN_REVIEW").length, percent: total ? Math.round(completed / total * 100) : null };
}

export function exposureOverview(applications: ExposureApplication[]) {
  const seen = new Set<string>();
  const priorities = applications.flatMap((app) => app.principais.map((finding) => ({ ...finding, applicationName: app.name })))
    .sort((a, b) => (severityOrder[a.severityFinal] ?? 4) - (severityOrder[b.severityFinal] ?? 4))
    .filter((finding) => { if (seen.has(finding.id)) return false; seen.add(finding.id); return true; }).slice(0, 3);
  return { open: applications.reduce((sum, app) => sum + app.totalAbertas, 0), critical: applications.reduce((sum, app) => sum + app.abertas.CRITICAL, 0), priorities };
}
