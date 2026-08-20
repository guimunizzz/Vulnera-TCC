/**
 * push.util.ts
 *
 * Envio de push via Expo Push Service (expo-server-sdk).
 *
 * ⚠️ Diferente de cvss.util/jwt.util, este utilitário NÃO toca o banco —
 * recebe `recipients` já resolvidos (userId + expoPushToken) por quem
 * chama. Quem resolve é o VulnerabilityService, que já tem UserRepository
 * injetado (ver `findClientsWithPushToken`); manter a consulta fora daqui
 * preserva a regra do CLAUDE.md de que só repositories tocam Prisma, e
 * evita transformar um utilitário "puro" numa classe com DI.
 *
 * Best-effort por design: NUNCA lança. Token inválido é pulado (skipped);
 * falha de rede/API vira entrada em `failures`. É responsabilidade de quem
 * chama decidir não deixar isso quebrar a operação principal — ver o
 * try/catch em torno da chamada dentro de VulnerabilityService.create.
 */

import { Expo, type ExpoPushMessage, type ExpoPushTicket } from "expo-server-sdk";

const expo = new Expo();

export interface PushRecipient {
  userId: string;
  expoPushToken: string;
}

export interface PushResult {
  sent: number;
  skipped: number; // token com formato inválido — nunca chegou a ser enviado
  failures: Array<{ userId: string; error: string }>;
}

/** Manda a mesma notificação pra vários usuários, em lotes (chunks) de ~100. */
export async function sendPushToUsers(
  recipients: PushRecipient[],
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<PushResult> {
  const valid = recipients.filter((r) => Expo.isExpoPushToken(r.expoPushToken));
  const result: PushResult = { sent: 0, skipped: recipients.length - valid.length, failures: [] };

  if (valid.length === 0) return result;

  const messages: ExpoPushMessage[] = valid.map((r) => ({
    to: r.expoPushToken,
    sound: "default",
    title,
    body,
    data,
  }));

  const chunks = expo.chunkPushNotifications(messages);
  let cursor = 0; // índice em `valid` — a ordem dos tickets acompanha a ordem das messages enviadas

  for (const chunk of chunks) {
    try {
      const tickets: ExpoPushTicket[] = await expo.sendPushNotificationsAsync(chunk);
      for (const ticket of tickets) {
        const recipient = valid[cursor];
        cursor += 1;
        if (ticket.status === "error") {
          result.failures.push({ userId: recipient?.userId ?? "desconhecido", error: ticket.message ?? "erro desconhecido" });
        } else {
          result.sent += 1;
        }
      }
    } catch (err) {
      for (let i = 0; i < chunk.length; i += 1) {
        const recipient = valid[cursor];
        cursor += 1;
        result.failures.push({ userId: recipient?.userId ?? "desconhecido", error: (err as Error).message });
      }
    }
  }

  return result;
}
