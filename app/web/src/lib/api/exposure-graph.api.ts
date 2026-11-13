/**
 * exposure-graph.api.ts
 *
 * Cliente do Exposure Graph da empresa. Sem parâmetros: a empresa é sempre a
 * de quem está logado (o backend deriva do token, nunca da URL).
 */

import { apiClient } from "./client";
import type { ExposureGraph } from "../../types/exposure-graph.types";

export const exposureGraphApi = {
  async obter(): Promise<ExposureGraph> {
    const { data } = await apiClient.get<ExposureGraph>("/companies/me/exposure-graph");
    return data;
  },
};
