import { apiClient } from "./client";
import type { User } from "../types/auth.types";

export const usersApi = {
  /** Escopo já vem resolvido pelo backend: CLIENT só vê a própria company — usado pra resolver nome de autor de comentário. */
  list: () => apiClient.get<User[]>("/users").then((res) => res.data),
};
