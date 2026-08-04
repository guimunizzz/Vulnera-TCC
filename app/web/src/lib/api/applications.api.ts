import { apiClient } from "./client";
import type { Application, CreateApplicationInput } from "../../types/application.types";

export const applicationsApi = {
  list: () => apiClient.get<Application[]>("/applications").then((res) => res.data),
  getById: (id: string) => apiClient.get<Application>(`/applications/${id}`).then((res) => res.data),
  create: (input: CreateApplicationInput) =>
    apiClient.post<Application>("/applications", input).then((res) => res.data),
  update: (id: string, input: Partial<CreateApplicationInput>) =>
    apiClient.put<Application>(`/applications/${id}`, input).then((res) => res.data),
  delete: (id: string) => apiClient.delete<void>(`/applications/${id}`).then((res) => res.data),
};
