/**
 * client.ts
 *
 * Espelha app/web/src/lib/api/client.ts — mesmo interceptor de refresh com
 * fila (evita rotação de refresh token disparada em paralelo quando várias
 * queries falham com 401 ao mesmo tempo). Única troca real: token lido/
 * escrito no useAuthStore do mobile (que por baixo já é SecureStore, não
 * localStorage — ver store/auth.store.ts).
 *
 * process.env.EXPO_PUBLIC_API_URL é embutido no bundle em build time pelo
 * Expo (mesmo mecanismo do import.meta.env.VITE_API_URL no Vite) — ver
 * .env.example pro aviso sobre localhost não funcionar em celular físico.
 */

import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "../store/auth.store";

const AUTH_PATHS_WITHOUT_REFRESH = ["/auth/login", "/auth/register", "/auth/refresh"];

export const apiClient = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL,
});

// EXPO_PUBLIC_* é embutido no bundle em build time — nada barra um build de
// produção saindo com URL http:// por engano (config errada de CI, .env
// esquecido). http:// é esperado em dev (emulador/LAN), mas em produção
// manda token e evidência em texto puro. Só avisa (não derruba o app) — o
// objetivo é aparecer em log/crash-report, não quebrar o app em runtime.
if (!__DEV__ && !process.env.EXPO_PUBLIC_API_URL?.startsWith("https://")) {
  console.error(
    "[client] EXPO_PUBLIC_API_URL não começa com https:// num build de produção — tokens e dados trafegariam em texto puro.",
  );
}

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
        `${process.env.EXPO_PUBLIC_API_URL}/auth/refresh`,
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
