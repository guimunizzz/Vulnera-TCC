import { apiClient } from "./client";
import type { User } from "../../types/auth.types";

export const usersApi = {
  /** Escopo já vem resolvido pelo backend: ADMIN vê todos, CLIENT só a própria company. */
  list: () => apiClient.get<User[]>("/users").then((res) => res.data),
};
