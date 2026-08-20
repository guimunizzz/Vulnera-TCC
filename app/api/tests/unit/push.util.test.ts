/**
 * push.util.test.ts
 *
 * Unitário do sendPushToUsers isolado (sem subir o Express/banco) — cobre
 * os três desfechos possíveis: envio ok, token com formato inválido
 * (skipped, nunca chega a ser mandado) e falha do "envio" (ticket de erro
 * OU exceção do SDK) — nenhum dos dois pode propagar pra quem chamou
 * (best-effort por design, ver cabeçalho do próprio arquivo).
 */

import { Expo } from "expo-server-sdk";
import { sendPushToUsers } from "../../src/utils/push.util";

const VALID_TOKEN = "ExponentPushToken[valid-001]";

describe("push.util — sendPushToUsers", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("envia pra token válido e conta em `sent`", async () => {
    const result = await sendPushToUsers([{ userId: "u1", expoPushToken: VALID_TOKEN }], "Título", "Corpo");
    expect(result.sent).toBe(1);
    expect(result.skipped).toBe(0);
    expect(result.failures).toHaveLength(0);
  });

  it("token com formato inválido é pulado (skipped) — nunca chega a ser enviado", async () => {
    const sendSpy = jest.spyOn(Expo.prototype, "sendPushNotificationsAsync");

    const result = await sendPushToUsers([{ userId: "u1", expoPushToken: "token-invalido" }], "Título", "Corpo");

    expect(result.skipped).toBe(1);
    expect(result.sent).toBe(0);
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it("ticket de erro do Expo vira entrada em `failures`, sem lançar", async () => {
    jest
      .spyOn(Expo.prototype, "sendPushNotificationsAsync")
      .mockResolvedValueOnce([{ status: "error", message: "DeviceNotRegistered" }]);

    const result = await sendPushToUsers([{ userId: "u1", expoPushToken: VALID_TOKEN }], "Título", "Corpo");

    expect(result.sent).toBe(0);
    expect(result.failures).toEqual([{ userId: "u1", error: "DeviceNotRegistered" }]);
  });

  it("exceção do SDK (ex: rede fora do ar) vira `failures` pra cada mensagem do lote, sem lançar", async () => {
    jest.spyOn(Expo.prototype, "sendPushNotificationsAsync").mockRejectedValueOnce(new Error("network down"));

    const result = await sendPushToUsers(
      [
        { userId: "u1", expoPushToken: VALID_TOKEN },
        { userId: "u2", expoPushToken: "ExponentPushToken[valid-002]" },
      ],
      "Título",
      "Corpo",
    );

    expect(result.sent).toBe(0);
    expect(result.failures).toHaveLength(2);
    expect(result.failures.map((f) => f.userId)).toEqual(["u1", "u2"]);
    expect(result.failures[0].error).toBe("network down");
  });

  it("lista vazia de destinatários não chama o SDK e devolve zeros", async () => {
    const sendSpy = jest.spyOn(Expo.prototype, "sendPushNotificationsAsync");
    const result = await sendPushToUsers([], "Título", "Corpo");
    expect(result).toEqual({ sent: 0, skipped: 0, failures: [] });
    expect(sendSpy).not.toHaveBeenCalled();
  });
});
