/**
 * Cliente Axios autenticado, consumido pelos módulos HTTP do frontend.
 * Compartilha o refresh dentro da sessão e descarta respostas da sessão anterior.
 */
import axios, { type AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "../../store/auth.store";

const AUTH_PATHS_WITHOUT_REFRESH = ["/auth/login", "/auth/refresh"];

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

type SessionRequest = InternalAxiosRequestConfig & {
  _retry?: boolean;
  _sessionVersion?: number;
};

function assertCurrentSession(request?: SessionRequest): void {
  if (request?._sessionVersion !== undefined && request._sessionVersion !== useAuthStore.getState().sessionVersion) {
    throw new axios.CanceledError("Sessão alterada");
  }
}

apiClient.interceptors.request.use((config: SessionRequest) => {
  assertCurrentSession(config);
  const { accessToken, sessionVersion } = useAuthStore.getState();
  config._sessionVersion = sessionVersion;
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

let activeRefresh: { sessionVersion: number; promise: Promise<void> } | undefined;

function refreshSession(request: SessionRequest, sessionVersion: number, refreshToken: string): Promise<void> {
  if (activeRefresh?.sessionVersion === sessionVersion) return activeRefresh.promise;

  const promise = axios.post<{ accessToken: string; refreshToken: string }>(
    `${apiClient.defaults.baseURL}/auth/refresh`,
    { refreshToken },
  ).then(({ data }) => {
    assertCurrentSession(request);
    useAuthStore.getState().setTokens(data.accessToken, data.refreshToken);
  }).catch((error: unknown) => {
    assertCurrentSession(request);
    useAuthStore.getState().clearAuth();
    throw error;
  }).finally(() => {
    if (activeRefresh?.promise === promise) activeRefresh = undefined;
  });

  activeRefresh = { sessionVersion, promise };
  return promise;
}

apiClient.interceptors.response.use(
  (response) => {
    assertCurrentSession(response.config);
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest: SessionRequest | undefined = error.config;
    assertCurrentSession(originalRequest);

    const isAuthEndpoint = AUTH_PATHS_WITHOUT_REFRESH.some((path) => originalRequest?.url?.includes(path));
    if (error.response?.status !== 401 || !originalRequest || isAuthEndpoint || originalRequest._retry) throw error;

    const { refreshToken, sessionVersion, clearAuth } = useAuthStore.getState();
    if (!refreshToken) {
      clearAuth();
      throw error;
    }

    originalRequest._retry = true;
    await refreshSession(originalRequest, sessionVersion, refreshToken);
    assertCurrentSession(originalRequest);
    return apiClient(originalRequest);
  },
);

export type { AxiosRequestConfig };
