/**
 * dast.api.ts
 *
 * `getReportHtml` busca o HTML do ZAP como TEXTO via axios autenticado (não
 * um `<iframe src="...">" apontando direto pra API — essa rota exige Bearer
 * token, que uma navegação de iframe/nova aba não carrega sozinha). A página
 * de relatório injeta o texto num `<iframe sandbox srcDoc={html}>`.
 */

import { apiClient } from "./client";
import type {
  ComparableScan,
  CreateDastScanInput,
  DastFinding,
  DastModuleStatus,
  DastReportData,
  DastScan,
  DastTriageStatus,
  PromoteInput,
  PromotionDraft,
  ScanComparison,
} from "../../types/dast.types";
import type { Vulnerability } from "../../types/vulnerability.types";

export const dastApi = {
  create: (input: CreateDastScanInput) => apiClient.post<DastScan>("/dast/scans", input).then((res) => res.data),

  list: () => apiClient.get<DastScan[]>("/dast/scans").then((res) => res.data),

  /** Estado do módulo: Docker disponível, execução/fila e avisos do watchdog. */
  getStatus: () => apiClient.get<DastModuleStatus>("/dast/scans/status").then((res) => res.data),

  getById: (id: string) => apiClient.get<DastScan>(`/dast/scans/${id}`).then((res) => res.data),

  cancel: (id: string) => apiClient.post<DastScan>(`/dast/scans/${id}/cancel`).then((res) => res.data),

  listFindings: (id: string) => apiClient.get<DastFinding[]>(`/dast/scans/${id}/findings`).then((res) => res.data),

  getReportData: (id: string) => apiClient.get<DastReportData>(`/dast/scans/${id}/report/data`).then((res) => res.data),

  getReportHtml: (id: string) =>
    apiClient.get<string>(`/dast/scans/${id}/report/html`, { responseType: "text" }).then((res) => res.data),

  /* ---- Triagem e promoção (ADR-032) ----
     Rotas sob /dast/scans/findings/... — o segmento literal "findings" vem
     ANTES do "/:id" paramétrico no router do backend, por isso funciona. */

  triage: (findingId: string, triageStatus: DastTriageStatus, note?: string | null) =>
    apiClient
      .patch<DastFinding>(`/dast/scans/findings/${findingId}/triage`, { triageStatus, note: note ?? null })
      .then((res) => res.data),

  getPromotionDraft: (findingId: string) =>
    apiClient.get<PromotionDraft>(`/dast/scans/findings/${findingId}/promotion-draft`).then((res) => res.data),

  promote: (findingId: string, input: PromoteInput) =>
    apiClient.post<Vulnerability>(`/dast/scans/findings/${findingId}/promote`, input).then((res) => res.data),

  /* ---- Comparação entre execuções ---- */

  listComparableScans: (id: string) =>
    apiClient.get<ComparableScan[]>(`/dast/scans/${id}/comparable`).then((res) => res.data),

  /** `id` é o scan mais NOVO; `baseScanId`, o mais antigo com que comparar. */
  compare: (id: string, baseScanId: string) =>
    apiClient.get<ScanComparison>(`/dast/scans/${id}/compare`, { params: { base: baseScanId } }).then((res) => res.data),
};
