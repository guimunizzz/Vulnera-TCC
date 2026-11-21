/**
 * Define semanas completas e prepara os valores da série semanal do Painel.
 * Usa UTC para acompanhar os limites e os rótulos do endpoint de métricas.
 */
import type { MetricsPoint } from "../api/metrics.api";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function lastFourWeeks(now: Date) {
  const dayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const daysSinceMonday = (now.getUTCDay() + 6) % 7;
  const thisMonday = dayStart - daysSinceMonday * (WEEK_MS / 7);
  const start = thisMonday - 4 * WEEK_MS;
  const weekStarts = Array.from({ length: 4 }, (_, index) =>
    new Date(start + index * WEEK_MS).toISOString().slice(0, 10));

  return { from: new Date(start).toISOString(), to: new Date(thisMonday - 1).toISOString(), weekStarts };
}

type WeeklyPoint = Pick<MetricsPoint, "periodo" | "criados" | "resolvidos">;

export function weeklyActivity(weekStarts: readonly string[], points: readonly WeeklyPoint[]) {
  const byWeek = new Map(points.map((point) => [point.periodo, point]));
  const weeks: WeeklyPoint[] = [];
  for (const start of weekStarts) {
    const point = byWeek.get(start);
    // O endpoint já preenche as semanas vazias. Uma semana ausente não vale zero.
    if (!point) return null;
    weeks.push(point);
  }

  return {
    weeks,
    created: weeks.reduce((sum, week) => sum + week.criados, 0),
    resolved: weeks.reduce((sum, week) => sum + week.resolvidos, 0),
    max: Math.max(1, ...weeks.map((week) => Math.max(week.criados, week.resolvidos))),
  };
}
