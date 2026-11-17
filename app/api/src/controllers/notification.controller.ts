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

  /** ADR-053 — central in-app: as do próprio usuário, mais recentes primeiro. `?unread=true` só as não lidas. */
  async list(req: Request, res: Response): Promise<Response> {
    try {
      const limite = req.query.limit !== undefined ? Number(req.query.limit) : undefined;
      if (limite !== undefined && !Number.isInteger(limite)) return res.status(400).json({ error: "INVALID_LIMIT" });
      return res.json(await this.service.listar(req.user!, req.query.unread === "true", limite));
    } catch (error) {
      console.error("NotificationController.list", error);
      return res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }

  async unreadCount(req: Request, res: Response): Promise<Response> {
    try {
      return res.json({ naoLidas: await this.service.contarNaoLidas(req.user!) });
    } catch (error) {
      console.error("NotificationController.unreadCount", error);
      return res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }

  async markRead(req: Request, res: Response): Promise<Response> {
    try {
      await this.service.marcarLida(req.user!, req.params.id as string);
      return res.status(204).send();
    } catch (error) {
      if (error instanceof Error && error.message === "NOTIFICATION_NOT_FOUND") return res.status(404).json({ error: "NOTIFICATION_NOT_FOUND" });
      console.error("NotificationController.markRead", error);
      return res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }

  async markAllRead(req: Request, res: Response): Promise<Response> {
    try {
      return res.json({ marcadas: await this.service.marcarTodasLidas(req.user!) });
    } catch (error) {
      console.error("NotificationController.markAllRead", error);
      return res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
}
