/**
 * reports.api.ts
 *
 * getReportData busca o JSON consolidado que os montadores de PDF
 * (lib/pdf/executive.ts e lib/pdf/technical.ts) usam pra desenhar o
 * documento inteiro no browser. create() só registra o metadado DEPOIS que
 * o PDF já foi montado e baixado — o servidor nunca vê o PDF em si
 * (ADR-003, geração client-side).
 */

import { apiClient } from "./client";
import type { Report, ReportData, ReportType } from "../../types/report.types";

export const reportsApi = {
  getReportData: (projectId: string) =>
    apiClient.get<ReportData>(`/projects/${projectId}/report-data`).then((res) => res.data),

  create: (projectId: string, type: ReportType) =>
    apiClient.post<Report>("/reports", { projectId, type }).then((res) => res.data),

  listByProject: (projectId: string) =>
    apiClient.get<Report[]>("/reports", { params: { projectId } }).then((res) => res.data),
};
