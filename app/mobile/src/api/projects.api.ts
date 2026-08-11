import { apiClient } from "./client";
import type { Project } from "../types/project.types";

// GET /projects sem filtro já vem escopado pelo backend por role (RN16) —
// pro CLIENT, só os projetos da própria company.
export const projectsApi = {
  list: () => apiClient.get<Project[]>("/projects").then((res) => res.data),
  getById: (id: string) => apiClient.get<Project>(`/projects/${id}`).then((res) => res.data),
};
