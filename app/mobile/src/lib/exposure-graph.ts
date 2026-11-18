/** Agrega categorias compartilhadas como na Web; consumido pela rede e seu painel de detalhes. */
import type { ExposureApplication, GraphSeverity } from "../types/exposure-graph.types";

export type SharedCategory = { code: string; total: number; severity: GraphSeverity; applications: { id: string; name: string; total: number }[] };
const severityRank: Record<GraphSeverity, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
export function sharedCategories(applications: ExposureApplication[]): SharedCategory[] {
  const categories = new Map<string, SharedCategory>();
  for (const app of applications) for (const category of app.categorias) {
    const current = categories.get(category.owaspCategory) ?? { code: category.owaspCategory, total: 0, severity: category.piorSeveridade, applications: [] };
    current.total += category.abertas;
    if (severityRank[category.piorSeveridade] < severityRank[current.severity]) current.severity = category.piorSeveridade;
    current.applications.push({ id: app.id, name: app.name, total: category.abertas });
    categories.set(current.code, current);
  }
  return [...categories.values()].map((category) => ({ ...category, applications: category.applications.sort((a, b) => b.total - a.total) }))
    .sort((a, b) => severityRank[a.severity] - severityRank[b.severity] || b.applications.length - a.applications.length || b.total - a.total);
}
