import { apiClient } from "./client";
import type { AuthResponse, LoginInput } from "../types/auth.types";

// Mobile é exclusivo do CLIENT (ADR-004) — sem register aqui, o cadastro de
// empresa/usuário acontece no onboarding web. logout() só invalida o refresh
// token no servidor; limpar o SecureStore local é responsabilidade de quem
// chama (ver settings.tsx).
export const authApi = {
  login: (input: LoginInput) => apiClient.post<AuthResponse>("/auth/login", input).then((res) => res.data),
  logout: (refreshToken: string) => apiClient.post<void>("/auth/logout", { refreshToken }).then((res) => res.data),
};
