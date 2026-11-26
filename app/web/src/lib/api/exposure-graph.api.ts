import { apiClient } from "./client";
import type {
  CombinacoesToxicas,
  ExposureGraph,
  HistoricoDaExposicao,
  Impacto,
  OpcaoDeImpacto,
  TipoDeImpacto,
} from "../../types/exposure-graph.types";

const BASE = "/companies/me/exposure-graph";

export const exposureGraphApi = {
  async obter(): Promise<ExposureGraph> {
    const { data } = await apiClient.get<ExposureGraph>(BASE);
    return data;
  },

  // Análises (ADR-061) — o escopo é sempre a company do usuário logado.
  async combinacoesToxicas(): Promise<CombinacoesToxicas> {
    const { data } = await apiClient.get<CombinacoesToxicas>(`${BASE}/toxic-combinations`);
    return data;
  },

  async opcoesDeImpacto(): Promise<OpcaoDeImpacto[]> {
    const { data } = await apiClient.get<OpcaoDeImpacto[]>(`${BASE}/blast-radius/options`);
    return data;
  },

  async impacto(tipo: TipoDeImpacto, valor: string): Promise<Impacto> {
    const { data } = await apiClient.get<Impacto>(`${BASE}/blast-radius`, { params: { tipo, valor } });
    return data;
  },

  async historico(): Promise<HistoricoDaExposicao> {
    const { data } = await apiClient.get<HistoricoDaExposicao>(`${BASE}/history`);
    return data;
  },
};
