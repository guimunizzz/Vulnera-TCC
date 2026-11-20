/** Converte novos achados e resoluções reais em duas séries na mesma escala do Painel. */
import type { MetricsPoint } from "../api/metrics.api";

export const TREND_PLOT = { width: 280, top: 8, bottom: 100, height: 108 } as const;

export function last30Days(now: Date) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 29));
  return { from: start.toISOString(), to: now.toISOString() };
}

type DailyCounts = Pick<MetricsPoint, "criados" | "resolvidos">;

export function trendGeometry(points: DailyCounts[]) {
  const { width, top, bottom } = TREND_PLOT;
  const maximum = points.reduce((max, point) => Math.max(max, point.criados, point.resolvidos), 1);
  const step = Math.ceil(maximum / 3);
  const ticks = Array.from({ length: Math.ceil(maximum / step) + 1 }, (_, index) => index * step).reverse();
  const y = (value: number) => bottom - (value / ticks[0]) * (bottom - top);
  const makeSeries = (key: keyof DailyCounts) => {
    const coordinates = points.map((point, index) => ({
      x: points.length > 1 ? index * width / (points.length - 1) : width / 2,
      y: y(point[key]),
    }));
    const path = coordinates.map((point, index) => `${index ? "L" : "M"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ");
    const length = coordinates.slice(1).reduce((sum, point, index) => sum + Math.hypot(point.x - coordinates[index].x, point.y - coordinates[index].y), 0);
    return { coordinates, path, length: Math.max(1, length), total: points.reduce((sum, point) => sum + point[key], 0) };
  };

  return { created: makeSeries("criados"), resolved: makeSeries("resolvidos"), grid: ticks.map((value) => ({ value, y: y(value) })) };
}
