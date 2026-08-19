import { useEffect, useState } from "react";
import { Platform } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import type * as NotificationsType from "expo-notifications";
import { notificationsApi } from "../api/notifications.api";
import { useAuthStore } from "../store/auth.store";

export type PushStatus = "verificando" | "ativado" | "negado" | "erro" | "indisponivel";

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
const pushUnsupported = isExpoGo && Platform.OS === "android";

let notificationHandlerConfigured = false;

export function usePushRegistration(): PushStatus {
  const [status, setStatus] = useState<PushStatus>("verificando");
  const accessToken = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    if (!accessToken) return;

    if (pushUnsupported) {
      console.warn(
        "[push] indisponível no Expo Go a partir do SDK 53 (Android). Use um development build para testar push: npx expo install expo-dev-client && npx expo run:android"
      );
      setStatus("indisponivel");
      return;
    }

    let cancelled = false;

    async function register(): Promise<void> {
      try {
        const Notifications: typeof NotificationsType = require("expo-notifications");

        if (!notificationHandlerConfigured) {
          Notifications.setNotificationHandler({
            handleNotification: async () => ({
              shouldShowAlert: true,
              shouldPlaySound: true,
              shouldSetBadge: false,
              shouldShowBanner: true,
              shouldShowList: true,
            }),
          });
          notificationHandlerConfigured = true;
        }

        if (Platform.OS === "android") {
          await Notifications.setNotificationChannelAsync("default", {
            name: "default",
            importance: Notifications.AndroidImportance.HIGH,
          });
        }

        const current = await Notifications.getPermissionsAsync();
        let finalStatus = current.status;
        if (finalStatus !== "granted") {
          const requested = await Notifications.requestPermissionsAsync();
          finalStatus = requested.status;
        }

        if (cancelled) return;
        if (finalStatus !== "granted") {
          setStatus("negado");
          return;
        }

        const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync();
        await notificationsApi.registerPush(expoPushToken);
        if (!cancelled) setStatus("ativado");
      } catch (err) {
        console.warn("[push] não foi possível registrar o token:", err);
        if (!cancelled) setStatus("erro");
      }
    }

    register();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  return status;
}