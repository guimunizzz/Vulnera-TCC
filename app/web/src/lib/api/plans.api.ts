import { apiClient } from "./client";
import type { Plan } from "../../types/plan.types";

export const plansApi = {
  list: () => apiClient.get<Plan[]>("/plans").then((res) => res.data),
};
