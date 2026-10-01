/**
 * query-client.ts
 *
 * Centraliza cache e recuperação das leituras consumidas por todas as telas.
 * Respeita a espera do rate limiter para que uma pausa recuperável continue
 * como carregamento; falhas definitivas e gravações não são repetidas.
 * Consumido pelo provider em main.tsx e pelos testes de navegação/carregamento.
 */

import { QueryClient } from "@tanstack/react-query";
import axios from "axios";

const MAX_RETRIES = 2;
const MAX_RATE_LIMIT_WAIT_MS = 30_000;

function rateLimitWaitMs(error: unknown): number {
  if (!axios.isAxiosError(error)) return 1_000;
  // O JSON é legível mesmo quando o CORS não expõe o cabeçalho Retry-After.
  const seconds: unknown = error.response?.data?.retryAfterSeconds;
  if (typeof seconds === "number" && Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1_000;
  }

  const header: unknown = error.response?.headers["retry-after"];
  if (typeof header === "string" || typeof header === "number") {
    const numeric = Number(header);
    if (String(header).trim() && Number.isFinite(numeric) && numeric >= 0) return numeric * 1_000;
    const date = Date.parse(String(header));
    if (Number.isFinite(date)) return Math.max(0, date - Date.now());
  }
  return 1_000;
}

function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= MAX_RETRIES || axios.isCancel(error) || !axios.isAxiosError(error)) return false;
  const status = error.response?.status;
  if (status === 429) return rateLimitWaitMs(error) <= MAX_RATE_LIMIT_WAIT_MS;
  return !error.response || [500, 502, 503, 504].includes(status ?? 0);
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Reutiliza uma leitura recente ao alternar páginas. invalidateQueries
        // e polling continuam atualizando os dados depois das ações do usuário.
        staleTime: 30_000,
        networkMode: "always",
        retry: shouldRetry,
        retryDelay: (attempt, error) =>
          axios.isAxiosError(error) && error.response?.status === 429
            ? rateLimitWaitMs(error) + 250
            : Math.min(500 * 2 ** attempt, 2_000),
        refetchOnWindowFocus: false,
      },
      mutations: { retry: false },
    },
  });
}

export const queryClient = createQueryClient();
