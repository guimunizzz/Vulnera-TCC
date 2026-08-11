import { apiClient } from "./client";
import type { Vulnerability } from "../types/vulnerability.types";

export const vulnerabilitiesApi = {
  listByProject: (projectId: string) =>
    apiClient.get<Vulnerability[]>("/vulnerabilities", { params: { projectId } }).then((res) => res.data),
  getById: (id: string) => apiClient.get<Vulnerability>(`/vulnerabilities/${id}`).then((res) => res.data),
};
