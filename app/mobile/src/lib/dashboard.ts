/**
 * Resume a distribuição atual de achados e projetos com as contagens da API.
 * Consumidor: gráficos da aba Painel.
 */
import type { ExposureApplication, GraphSeverity } from "../types/exposure-graph.types";
import type { Project, ProjectStatus } from "../types/project.types";

export const graphSeverities = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;

export function exposureOverview(applications: readonly ExposureApplication[]) {
  const bySeverity: Record<GraphSeverity, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  let mainApplication: ExposureApplication | undefined;

  for (const application of applications) {
    for (const severity of graphSeverities) bySeverity[severity] += application.abertas[severity];
    // O histórico tem um recorte explícito e requer só uma consulta, mesmo com muitas aplicações.
    if (!mainApplication || application.totalAbertas > mainApplication.totalAbertas) mainApplication = application;
  }

  return {
    bySeverity,
    total: graphSeverities.reduce((sum, severity) => sum + bySeverity[severity], 0),
    mainApplication,
  };
}

export function projectsByStatus(projects: readonly Project[]): Record<ProjectStatus, number> {
  const counts = { PENDING: 0, IN_PROGRESS: 0, IN_REVIEW: 0, COMPLETED: 0 };
  for (const project of projects) counts[project.status] += 1;
  return counts;
}
