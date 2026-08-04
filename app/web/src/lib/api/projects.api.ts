import { apiClient } from "./client";
import type { CreateProjectInput, Project, ProjectStatus, UpdateProjectInput } from "../../types/project.types";

export const projectsApi = {
  list: () => apiClient.get<Project[]>("/projects").then((res) => res.data),
  getById: (id: string) => apiClient.get<Project>(`/projects/${id}`).then((res) => res.data),
  create: (input: CreateProjectInput) => apiClient.post<Project>("/projects", input).then((res) => res.data),
  update: (id: string, input: UpdateProjectInput) =>
    apiClient.put<Project>(`/projects/${id}`, input).then((res) => res.data),
  transition: (id: string, toStatus: ProjectStatus) =>
    apiClient.post<Project>(`/projects/${id}/transition`, { toStatus }).then((res) => res.data),
};
