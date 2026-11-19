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
  NovoAgendamentoInput,
  PainelAgendamentos,
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

  atualizar: (applicationId: string, scheduleId: string, input: EdicaoAgendamentoInput) =>
    apiClient.put<Agendamento>(`/applications/${applicationId}/dast-schedules/${scheduleId}`, input).then((res) => res.data),

  remover: (applicationId: string, scheduleId: string) =>
    apiClient.delete<void>(`/applications/${applicationId}/dast-schedules/${scheduleId}`).then(() => undefined),
};
