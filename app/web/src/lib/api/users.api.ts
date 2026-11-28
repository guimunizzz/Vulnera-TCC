import { apiClient } from "./client";
import type { User } from "../../types/auth.types";

type UserDirectoryEntry = Pick<User, "id" | "name"> & Partial<Pick<User, "role">>;

export const usersApi = {
  /** Perfil autoritativo após o cadastro da empresa, sem exigir novo login. */
  me: () => apiClient.get<User>("/users/me").then((res) => res.data),
  /** A API limita a listagem à empresa do CLIENT e a projeção ao papel empresarial. */
  list: () => apiClient.get<UserDirectoryEntry[]>("/users").then((res) => res.data),
};
