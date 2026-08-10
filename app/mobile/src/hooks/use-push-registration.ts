/**
 * use-push-registration.ts
 *
 * Pede permissão de notificação, captura o Expo push token e registra no
 * backend (POST /notifications/register-push). Roda de novo sempre que o
 * usuário loga (accessToken muda) — é barato e idempotente (o backend só
 * faz um UPDATE do campo, ver notification.service.ts).
 *
 * ⚠️ Falha aqui NUNCA deve travar o app — é sempre best-effort (mesmo
 * espírito do lado do backend, que nunca deixa falha de push quebrar a
 * criação de um finding). Por isso todo erro cai num console.warn + estado
 * "error", nunca uma exception não tratada.
 */

import { useEffect, useState } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { notificationsApi } from "../api/notifications.api";
import { useAuthStore } from "../store/auth.store";

export type PushStatus = "verificando" | "ativado" | "negado" | "erro" | "indisponivel";

// Enquanto o app está aberto, mostra o alerta normalmente (banner + som) —
// sem isso, o Expo por padrão NÃO exibe notificação recebida em foreground.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function usePushRegistration(): PushStatus {
  const [status, setStatus] = useState<PushStatus>("verificando");
  const accessToken = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;

    async function register(): Promise<void> {
      try {
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
        // Best-effort: emulador sem Google Play Services, app rodando na web
        // (expo start --web) ou token indisponível caem aqui — nunca travam o app.
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
