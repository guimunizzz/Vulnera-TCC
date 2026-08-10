import type { Request, Response } from "express";
import type { NotificationService } from "../services/notification.service";

// Formato mínimo de um push token Expo — não valida contra o serviço da
// Expo (isso seria uma chamada de rede síncrona no meio do login), só
// garante que não é vazio/lixo óbvio antes de gravar.
const EXPO_PUSH_TOKEN_REGEX = /^Expo(nent)?PushToken\[.+\]$/;

export class NotificationController {
  constructor(private readonly service: NotificationService) {}

  async registerPush(req: Request, res: Response): Promise<Response> {
    try {
      const body = req.body as Partial<{ expoPushToken: string }>;

      if (!body.expoPushToken || typeof body.expoPushToken !== "string" || !EXPO_PUSH_TOKEN_REGEX.test(body.expoPushToken)) {
        return res.status(400).json({ error: "INVALID_EXPO_PUSH_TOKEN" });
      }

      const actor = req.user!;
      await this.service.registerPush(actor, body.expoPushToken);
      return res.status(204).send();
    } catch (error) {
      console.error("NotificationController.registerPush", error);
      return res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
}
