import { apiClient } from "./client";
import type { User } from "../types/auth.types";

export const usersApi = {
  me: (signal?: AbortSignal) => apiClient.get<User>("/users/me", { signal }).then((res) => res.data),
  /** Escopo já vem resolvido pelo backend: CLIENT só vê a própria company — usado pra resolver nome de autor de comentário. */
  list: (signal?: AbortSignal) => apiClient.get<User[]>("/users", { signal }).then((res) => res.data),
};
