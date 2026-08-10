import { apiClient } from "./client";

export const notificationsApi = {
  registerPush: (expoPushToken: string) =>
    apiClient.post<void>("/notifications/register-push", { expoPushToken }).then((res) => res.data),
};
