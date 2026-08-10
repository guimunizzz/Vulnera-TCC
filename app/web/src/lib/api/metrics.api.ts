/**
 * metrics.api.ts
 *
 * Cliente dos quatro endpoints de métricas (Fase 6.5, CP4).
 *
 * O QUE ESTE ARQUIVO RESOLVE
 * Traduzir o `FiltroMetricas` (que vive na URL do dashboard) para query string,
 * num lugar só. Sem isso, cada uma das quatro chamadas montaria a query à mão e
 * a primeira divergência de nome de parâmetro viraria um filtro que "não pega"
 * numa aba e pega nas outras.
 *
 * QUEM USA
 * Os hooks do dashboard (`use-metrics.ts`) via TanStack Query.
 */

import { apiClient } from "./client";
import type {
  FiltroMetricas,
  MetricsComparison,
  MetricsInsights,
  MetricsSummary,
  MetricsTimeseries,
} from "../../types/metrics.types";

/**
 * Filtro → query string.
 *
 * Listas viram `a,b,c` porque é o formato que o controller lê (`lerLista`).
 * Chaves vazias são OMITIDAS: mandar `severity=` faria a URL crescer sem
 * mudar o resultado e poluiria a chave de cache do TanStack Query, provocando
 * refetch de dado idêntico.
 */
export function montarQuery(filtro: FiltroMetricas): string {
  const p = new URLSearchParams();
  if (filtro.from) p.set("from", filtro.from);
  if (filtro.to) p.set("to", filtro.to);
  if (filtro.severity?.length) p.set("severity", filtro.severity.join(","));
  if (filtro.status?.length) p.set("status", filtro.status.join(","));
  if (filtro.owasp?.length) p.set("owasp", filtro.owasp.join(","));
  if (filtro.granularity) p.set("granularity", filtro.granularity);
  if (filtro.compare) p.set("compare", "previous");
  const s = p.toString();
  return s ? `?${s}` : "";
}

export const metricsApi = {
  async summary(applicationId: string, filtro: FiltroMetricas = {}): Promise<MetricsSummary> {
    const { data } = await apiClient.get<MetricsSummary>(`/applications/${applicationId}/metrics/summary${montarQuery(filtro)}`);
    return data;
  },

  async timeseries(applicationId: string, filtro: FiltroMetricas = {}): Promise<MetricsTimeseries> {
    const { data } = await apiClient.get<MetricsTimeseries>(
      `/applications/${applicationId}/metrics/timeseries${montarQuery(filtro)}`,
    );
    return data;
  },

  async insights(applicationId: string, filtro: FiltroMetricas = {}): Promise<MetricsInsights> {
    const { data } = await apiClient.get<MetricsInsights>(`/applications/${applicationId}/metrics/insights${montarQuery(filtro)}`);
    return data;
  },

  async comparison(filtro: FiltroMetricas = {}): Promise<MetricsComparison> {
    const { data } = await apiClient.get<MetricsComparison>(`/companies/me/metrics/comparison${montarQuery(filtro)}`);
    return data;
  },
};
