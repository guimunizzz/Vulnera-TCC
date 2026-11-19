/** Consultas da Threat Intel para o cliente; a API determina a empresa a partir da sessão. */
import { apiClient } from "./client";

export type ThreatOverview = { inventario: { confirmados: number; sugeridos: number; descartados: number }; casamentos: { porTriagem: Record<string, number>; kevAbertos: number; criticosAbertos: number; novosSemana: number; tecnologiasAfetadas: number }; ultimaExecucao: { finishedAt: string | null; status: string } | null; sincronizando: boolean };
export type ThreatAdvisory = { id: string; aliases: string[]; title: string | null; description: string | null; severity: string | null; cvssScore: number | null; publishedAt: string | null; kev: boolean; epssScore: number | null };
export type ThreatMatch = { id: string; advisory: ThreatAdvisory; asset: { id: string; displayName: string; version: string | null }; versionConfirmed: boolean; fixedVersion: string | null; triageStatus: string; createdAt: string };
export type ThreatAsset = { id: string; displayName: string; status: string; version: string | null; source: string; casamentos: number };
export type ThreatFeedItem = ThreatAdvisory & { afeta: boolean };

export const threatIntelApi = {
  overview: (signal?: AbortSignal) => apiClient.get<ThreatOverview>("/threat-intel/overview", { signal }).then((response) => response.data),
  matches: (signal?: AbortSignal) => apiClient.get<ThreatMatch[]>("/threat-intel/matches", { signal }).then((response) => response.data),
  assets: (signal?: AbortSignal) => apiClient.get<ThreatAsset[]>("/threat-intel/assets", { signal }).then((response) => response.data),
  feed: (signal?: AbortSignal) => apiClient.get<ThreatFeedItem[]>("/threat-intel/feed", { signal, params: { days: 30 } }).then((response) => response.data),
};
