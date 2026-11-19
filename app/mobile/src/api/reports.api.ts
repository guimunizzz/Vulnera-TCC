/** Consulta dados e histórico de relatórios e registra geração do PDF após criação local. */
import { apiClient } from "./client";
import type { ReportData, ReportEntry } from "../types/report.types";

export const reportsApi = {
  data: (id: string, signal?: AbortSignal) => apiClient.get<ReportData>(`/projects/${encodeURIComponent(id)}/report-data`, { signal }).then((response) => response.data),
  history: (id: string, signal?: AbortSignal) => apiClient.get<ReportEntry[]>("/reports", { params: { projectId: id }, signal }).then((response) => response.data),
  register: (id: string) => apiClient.post<ReportEntry>("/reports", { projectId: id, type: "EXECUTIVE" }).then((response) => response.data),
};
