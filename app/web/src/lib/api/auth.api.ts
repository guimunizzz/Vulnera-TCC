import { apiClient } from "./client";
import type { AuthResponse, LoginInput, RegisterInput } from "../../types/auth.types";

export const authApi = {
  login: (input: LoginInput) => apiClient.post<AuthResponse>("/auth/login", input).then((res) => res.data),

  register: (input: RegisterInput) =>
    apiClient.post<AuthResponse>("/auth/register", input).then((res) => res.data),

  logout: (refreshToken: string) => apiClient.post<void>("/auth/logout", { refreshToken }).then((res) => res.data),
};
