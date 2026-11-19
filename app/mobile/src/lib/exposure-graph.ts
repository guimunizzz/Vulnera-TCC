/** Agrega categorias compartilhadas como na Web; consumido pela rede e seu painel de detalhes. */
import type { ExposureApplication, GraphSeverity } from "../types/exposure-graph.types";

export type SharedCategory = { code: string; total: number; severity: GraphSeverity; applications: { id: string; name: string; total: number }[] };
type Point = { x: number; y: number };
export type GraphLayout = "columns" | "rows";

/** Distribui os mesmos nós em camadas horizontais ou verticais. */
export function graphLayout(layout: GraphLayout, appCount: number, categoryCount: number) {
  const rows = layout === "rows";
  const count = Math.max(appCount, categoryCount, 1);
  const width = rows ? Math.max(168, count * 140 + 24) : categoryCount ? 620 : 420;
  const height = rows ? (categoryCount ? 330 : 225) : Math.max(220, count * 96 + 24);
  const positions = (size: number, layer: number): Point[] => Array.from({ length: size }, (_, index) => {
    const spread = index - (size - 1) / 2;
    return rows ? { x: width / 2 + spread * 140, y: layer } : { x: layer, y: height / 2 + spread * 96 };
  });
  return {
    width, height,
    company: rows ? { x: width / 2, y: 50 } : { x: 104, y: height / 2 },
    applications: positions(appCount, rows ? 155 : 300),
    categories: positions(categoryCount, rows ? 260 : 510),
  };
}
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
