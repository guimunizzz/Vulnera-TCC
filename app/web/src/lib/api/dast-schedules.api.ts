/**
 * dast-schedules.api.ts — scans DAST agendados (ADR-056).
 *
 * Leitura global pela página /agendamentos (`/dast-schedules`); criar,
 * editar, remover e autorizar continuam por aplicação, como na API. O
 * companyId nunca vai no request: o servidor deriva da aplicação.
 */

import { apiClient } from "./client";
import type {
  AlvoDast,
  Agendamento,
  AutorizacaoDast,
  EdicaoAgendamentoInput,
  ExecucaoAgendamento,
  NovoAgendamentoInput,
  NovoAgendamentoPorUrlInput,
  PainelAgendamentos,
  ResultadoRodarAgora,
} from "../../types/dast-schedule.types";

export const dastSchedulesApi = {
  painel: () => apiClient.get<PainelAgendamentos>("/dast-schedules").then((res) => res.data),

  alvos: () => apiClient.get<AlvoDast[]>("/dast-schedules/targets").then((res) => res.data),

  autorizar: (applicationId: string, until: string) =>
    apiClient.put<AutorizacaoDast>(`/applications/${applicationId}/dast-authorization`, { until }).then((res) => res.data),

  revogar: (applicationId: string) =>
    apiClient.delete<AutorizacaoDast>(`/applications/${applicationId}/dast-authorization`).then((res) => res.data),

  criar: (applicationId: string, input: NovoAgendamentoInput) =>
    apiClient.post<Agendamento>(`/applications/${applicationId}/dast-schedules`, input).then((res) => res.data),

  /** Agendamento só por URL: sem aplicação, empresa nem projeto. */
  criarPorUrl: (input: NovoAgendamentoPorUrlInput) => apiClient.post<Agendamento>("/dast-schedules", input).then((res) => res.data),

  /** Editar e remover pelo id servem aos dois tipos; a API aplica as regras de cada um. */
  atualizar: (scheduleId: string, input: EdicaoAgendamentoInput) =>
    apiClient.put<Agendamento>(`/dast-schedules/${scheduleId}`, input).then((res) => res.data),

  remover: (scheduleId: string) => apiClient.delete<void>(`/dast-schedules/${scheduleId}`).then(() => undefined),

  /** "Rodar agora": o mesmo caminho do worker, com as mesmas checagens (pausado devolve DISABLED). */
  rodarAgora: (scheduleId: string) => apiClient.post<ResultadoRodarAgora>(`/dast-schedules/${scheduleId}/run`).then((res) => res.data),

  /** Últimas execuções, da mais recente para a mais antiga, com o diff contra a anterior. */
  historico: (scheduleId: string, limite = 10) =>
    apiClient.get<ExecucaoAgendamento[]>(`/dast-schedules/${scheduleId}/history`, { params: { limit: limite } }).then((res) => res.data),
};
