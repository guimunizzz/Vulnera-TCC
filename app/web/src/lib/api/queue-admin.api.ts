/**
 * queue-admin.api.ts — painel de filas do ADMIN (ADR-056).
 * Só ADMIN; a API recusa os outros papéis com 403.
 */

import { apiClient } from "./client";
import type { JobReprocessado, PainelFilas } from "../../types/queue-admin.types";

export const queueAdminApi = {
  painel: () => apiClient.get<PainelFilas>("/admin/queues").then((res) => res.data),

  reprocessar: (fila: string, jobId: string) =>
    apiClient
      .post<JobReprocessado>(`/admin/queues/${encodeURIComponent(fila)}/jobs/${encodeURIComponent(jobId)}/retry`)
      .then((res) => res.data),
};
