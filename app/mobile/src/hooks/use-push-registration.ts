import { createContext, useContext, useEffect, useState } from "react";
import { AppState, Platform } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import * as Notifications from "expo-notifications";
import { notificationsApi } from "../api/notifications.api";
import { useAuthStore } from "../store/auth.store";

type PushStatus = "verificando" | "ativado" | "negado" | "erro" | "indisponivel";
// O layout registra uma vez e Configurações lê o mesmo resultado, sem novo POST.
export const PushStatusContext = createContext<PushStatus>("verificando");
export function usePushStatus(): PushStatus { return useContext(PushStatusContext); }

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
const pushUnsupported = Platform.OS === "web" || (isExpoGo && Platform.OS === "android");

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
    let registering = false;

    async function register(): Promise<void> {
      if (registering || cancelled) return;
      registering = true;
      try {
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
        // Nunca loga o objeto de erro cru: se vier de uma chamada à API, ele
        // carrega error.config.headers (com o Authorization: Bearer vivo) e
        // o corpo bruto da resposta — só a mensagem é segura pro console.
        const mensagem = err instanceof Error ? err.message : String(err);
        console.warn("[push] não foi possível registrar o token:", mensagem);
        if (!cancelled) setStatus("erro");
      } finally {
        registering = false;
      }
    }

    register();
    const listener = AppState.addEventListener("change", (state) => { if (state === "active") void register(); });
    return () => {
      cancelled = true;
      listener.remove();
    };
  }, [accessToken]);

  return status;
}
