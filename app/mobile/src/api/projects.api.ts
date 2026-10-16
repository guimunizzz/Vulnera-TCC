import { apiClient } from "./client";
import type { Project } from "../types/project.types";

// GET /projects sem filtro já vem escopado pelo backend por role (RN16) —
// pro CLIENT, só os projetos da própria company.
export const projectsApi = {
  list: (signal?: AbortSignal) => apiClient.get<Project[]>("/projects", { signal }).then((res) => res.data),
  getById: (id: string, signal?: AbortSignal) => apiClient.get<Project>(`/projects/${id}`, { signal }).then((res) => res.data),
};
