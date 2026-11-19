/** Consulta a série histórica de uma aplicação para o gráfico do painel do cliente. */
import { apiClient } from "./client";

export type MetricsPoint = { periodo: string; criados: number; resolvidos: number; abertosAcumulados: number };
export type MetricsSeries = { applicationId: string; periodo: { de: string; ate: string }; granularidade: "day" | "week" | "month"; pontos: MetricsPoint[] };

export const metricsApi = {
  timeseries: (applicationId: string, from: string, to: string, signal?: AbortSignal) =>
    apiClient.get<MetricsSeries>(`/applications/${encodeURIComponent(applicationId)}/metrics/timeseries`, { params: { from, to, granularity: "day" }, signal }).then((response) => response.data),
};
