/**
 * evidences.api.ts
 *
 * Diferente do web (que baixa a evidência como Blob pra disparar download),
 * o mobile só PRECISA exibir a imagem — então em vez de buscar bytes e
 * converter, monta a URL do endpoint autenticado e deixa o próprio
 * <Image source={{ uri, headers }}> do React Native buscar e cachear.
 * O token vai no HEADER Authorization, nunca na query string da URL.
 */

import { apiClient } from "./client";
import type { Evidence } from "../types/evidence.types";

export const evidencesApi = {
  list: (vulnerabilityId: string) =>
    apiClient.get<Evidence[]>(`/vulnerabilities/${vulnerabilityId}/evidences`).then((res) => res.data),

  downloadUrl: (vulnerabilityId: string, evidenceId: string): string =>
    `${apiClient.defaults.baseURL}/vulnerabilities/${vulnerabilityId}/evidences/${evidenceId}`,
};
