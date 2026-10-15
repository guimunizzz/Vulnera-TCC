import { apiClient } from "./client";
import type { User } from "../../types/auth.types";

export const usersApi = {
  /** Perfil autoritativo após o cadastro da empresa, sem exigir novo login. */
  me: () => apiClient.get<User>("/users/me").then((res) => res.data),
  /** Escopo já vem resolvido pelo backend: ADMIN vê todos, CLIENT só a própria company. */
  list: () => apiClient.get<User[]>("/users").then((res) => res.data),
};
