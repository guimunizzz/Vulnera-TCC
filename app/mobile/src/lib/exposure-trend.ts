/** Converte contagens reais de novos achados em geometria para o gráfico do painel. */
import type { MetricsPoint } from "../api/metrics.api";

export function last30Days(now: Date) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 29));
  return { from: start.toISOString(), to: now.toISOString() };
}

export function trendGeometry(points: MetricsPoint[]) {
  const width = 280, top = 8, bottom = 100;
  const maximum = Math.max(1, ...points.map((point) => point.criados));
  const coordinates = points.map((point, index) => ({
    x: points.length > 1 ? index * width / (points.length - 1) : width / 2,
    y: bottom - (point.criados / maximum) * (bottom - top),
  }));
  const path = coordinates.map((point, index) => `${index ? "L" : "M"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ");
  const length = coordinates.slice(1).reduce((sum, point, index) => sum + Math.hypot(point.x - coordinates[index].x, point.y - coordinates[index].y), 0);
  return { path, length: Math.max(1, length), maximum, total: points.reduce((sum, point) => sum + point.criados, 0) };
}
