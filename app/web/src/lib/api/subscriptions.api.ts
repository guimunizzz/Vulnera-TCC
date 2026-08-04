import { apiClient } from "./client";
import type { Subscription } from "../../types/subscription.types";

export const subscriptionsApi = {
  request: (input: { planId: string }) =>
    apiClient.post<Subscription>("/subscriptions", input).then((res) => res.data),
  listPending: () => apiClient.get<Subscription[]>("/subscriptions/pending").then((res) => res.data),
  current: () => apiClient.get<Subscription>("/subscriptions/current").then((res) => res.data),
  approve: (id: string) => apiClient.post<Subscription>(`/subscriptions/${id}/approve`).then((res) => res.data),
  reject: (id: string) => apiClient.post<Subscription>(`/subscriptions/${id}/reject`).then((res) => res.data),
};
