/**
 * Classifica falhas de leitura sem expor o corpo retornado pela API.
 * Usado pelas páginas que carregam recursos identificados pela URL.
 */
import axios from "axios";

export type ResourceFailure = "unauthorized" | "unavailable" | "rate-limited" | "connectivity" | "operational";

export function getResourceFailure(error: unknown): ResourceFailure | null {
  if (error == null) return null;
  if (!axios.isAxiosError(error)) return "operational";

  switch (error.response?.status) {
    case 401: return "unauthorized";
    case 403:
    case 404: return "unavailable";
    case 429: return "rate-limited";
    case undefined: return "connectivity";
    default: return "operational";
  }
}
