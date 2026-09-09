/**
 * dast.api.ts
 *
 * `getReportHtml` busca o HTML do ZAP como TEXTO via axios autenticado (não
 * um `<iframe src="...">" apontando direto pra API — essa rota exige Bearer
 * token, que uma navegação de iframe/nova aba não carrega sozinha). A página
 * de relatório injeta o texto num `<iframe sandbox srcDoc={html}>`.
 */

import { apiClient } from "./client";
import type { CreateDastScanInput, DastFinding, DastReportData, DastScan } from "../../types/dast.types";

export const dastApi = {
  create: (input: CreateDastScanInput) => apiClient.post<DastScan>("/dast/scans", input).then((res) => res.data),

  list: () => apiClient.get<DastScan[]>("/dast/scans").then((res) => res.data),

  getById: (id: string) => apiClient.get<DastScan>(`/dast/scans/${id}`).then((res) => res.data),

  cancel: (id: string) => apiClient.post<DastScan>(`/dast/scans/${id}/cancel`).then((res) => res.data),

  listFindings: (id: string) => apiClient.get<DastFinding[]>(`/dast/scans/${id}/findings`).then((res) => res.data),

  getReportData: (id: string) => apiClient.get<DastReportData>(`/dast/scans/${id}/report/data`).then((res) => res.data),

  getReportHtml: (id: string) =>
    apiClient.get<string>(`/dast/scans/${id}/report/html`, { responseType: "text" }).then((res) => res.data),
};
