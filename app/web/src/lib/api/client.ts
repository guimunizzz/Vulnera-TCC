/**
 * client.ts
 *
 * Instância Axios central da Vulnera API.
 *
 * - Request interceptor: anexa o accessToken (se houver) em todo request.
 * - Response interceptor: em 401 por token expirado, tenta 1 refresh e
 *   reenvia o request original. Se várias requests falharem ao mesmo tempo
 *   (ex: dashboard disparando 3 queries em paralelo), só UM refresh roda —
 *   as outras entram numa fila e são liberadas quando o refresh original
 *   termina (senão cada uma dispararia sua própria rotação de refresh token
 *   e todas menos a última seriam invalidadas pela rotation).
 */

import axios, { AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "../../store/auth.store";

const AUTH_PATHS_WITHOUT_REFRESH = ["/auth/login", "/auth/register", "/auth/refresh"];

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

apiClient.interceptors.request.use((config) => {
  const { accessToken } = useAuthStore.getState();
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

let isRefreshing = false;
let queue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null): void {
  queue.forEach(({ resolve, reject }) => {
    if (error || !token) reject(error);
    else resolve(token);
  });
  queue = [];
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;

    const isAuthEndpoint = AUTH_PATHS_WITHOUT_REFRESH.some((path) => originalRequest?.url?.includes(path));

    if (error.response?.status !== 401 || !originalRequest || isAuthEndpoint || originalRequest._retry) {
      return Promise.reject(error);
    }

    const { refreshToken, setTokens, clearAuth } = useAuthStore.getState();
    if (!refreshToken) {
      clearAuth();
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        queue.push({ resolve, reject });
      }).then((newToken) => {
        originalRequest._retry = true;
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(originalRequest);
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const { data } = await axios.post<{ accessToken: string; refreshToken: string }>(
        `${import.meta.env.VITE_API_URL}/auth/refresh`,
        { refreshToken },
      );
      setTokens(data.accessToken, data.refreshToken);
      processQueue(null, data.accessToken);
      originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
      return apiClient(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      clearAuth();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);

export type { AxiosRequestConfig };
