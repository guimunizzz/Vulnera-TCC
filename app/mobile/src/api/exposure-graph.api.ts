/** Consulta a projeção da empresa autenticada para a tela de exposição do cliente. */
import { apiClient } from "./client";
import type { ExposureGraph } from "../types/exposure-graph.types";

export const exposureGraphApi = {
  get: (signal?: AbortSignal) => apiClient.get<ExposureGraph>("/companies/me/exposure-graph", { signal }).then((response) => response.data),
};
