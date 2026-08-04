import { apiClient } from "./client";
import type { ProjectMember } from "../../types/project-member.types";

export const projectMembersApi = {
  list: (projectId: string) =>
    apiClient.get<ProjectMember[]>(`/projects/${projectId}/members`).then((res) => res.data),
  add: (projectId: string, userId: string) =>
    apiClient.post<ProjectMember>(`/projects/${projectId}/members`, { userId }).then((res) => res.data),
  remove: (projectId: string, userId: string) =>
    apiClient.delete<void>(`/projects/${projectId}/members/${userId}`).then((res) => res.data),
};
