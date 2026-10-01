import { apiClient } from "./client";
import type { Vulnerability } from "../types/vulnerability.types";

/**
 * Envelope de `GET /vulnerabilities` desde a FEAT-09.
 *
 * ⚠️ O endpoint passou a ser paginado e a devolver `{ data, pagination,
 * facets }` em vez de um array cru. O mobile é read-only e mostra a lista
 * inteira do projeto numa tela só, então pede a página máxima (100) em vez de
 * paginar: um projeto com mais de 100 findings é caso que o app não atende
 * hoje, e paginar aqui seria construir interface para um cenário que ainda
 * não existe. Se acontecer, o `pagination.total` da resposta é que vai dizer.
 */
interface RespostaDeBusca {
  data: Vulnerability[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

/** Teto do backend (PAGE_SIZE_MAX). Pedir mais é clampado, não recusado. */
const PAGE_SIZE_MAX = 100;

export const vulnerabilitiesApi = {
  listByProject: (projectId: string) =>
    apiClient
      .get<RespostaDeBusca>("/vulnerabilities", { params: { projectId, pageSize: PAGE_SIZE_MAX } })
      .then((res) => res.data.data),
  getById: (id: string) => apiClient.get<Vulnerability>(`/vulnerabilities/${id}`).then((res) => res.data),
};
