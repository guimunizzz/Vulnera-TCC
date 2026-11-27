/**
 * Valida a fronteira HTTP do assistente e serializa apenas o contrato público.
 * Impede campos extras de autoridade; consumido pelas rotas montadas via factory.
 */
import type { Request, Response } from "express";
import { ASSISTANT_SCREENS, type AssistantChatDTO, type AssistantHistoryMessage, type AssistantScreen } from "../models/assistant.model";
import type { AssistantService } from "../services/assistant.service";

export class AssistantController {
  constructor(private readonly service: AssistantService) {}

  async chat(req: Request, res: Response): Promise<Response> {
    try {
      const body: unknown = req.body;
      if (!body || typeof body !== "object" || Array.isArray(body)) return res.status(400).json({ error: "INVALID_ASSISTANT_REQUEST" });
      const data = body as Record<string, unknown>;
      if (Object.keys(data).some((key) => !["question", "screen", "history"].includes(key))) return res.status(400).json({ error: "INVALID_ASSISTANT_REQUEST" });
      if (typeof data.question !== "string" || !data.question.trim() || data.question.length > 1_000) return res.status(400).json({ error: "INVALID_QUESTION" });
      if (typeof data.screen !== "string" || !ASSISTANT_SCREENS.includes(data.screen as AssistantScreen)) return res.status(400).json({ error: "INVALID_SCREEN" });
      if (!Array.isArray(data.history) || data.history.length > 6) return res.status(400).json({ error: "INVALID_HISTORY" });
      let total = 0;
      for (const item of data.history) {
        if (!item || typeof item !== "object" || Array.isArray(item) || Object.keys(item).some((key) => !["role", "content"].includes(key)) || !["user", "assistant"].includes(item.role) || typeof item.content !== "string" || !item.content.trim() || item.content.length > 1_000) {
          return res.status(400).json({ error: "INVALID_HISTORY" });
        }
        total += item.content.length;
      }
      if (total > 4_000) return res.status(400).json({ error: "INVALID_HISTORY" });
      const dto: AssistantChatDTO = { question: data.question.trim(), screen: data.screen as AssistantScreen, history: data.history as AssistantHistoryMessage[] };
      return res.status(200).json(await this.service.chat(req.user!, dto));
    } catch (error) {
      if (error instanceof Error && error.message === "FORBIDDEN") return res.status(403).json({ error: "FORBIDDEN" });
      // Não registrar o objeto de erro: pode conter payload/config de um gateway.
      console.error("AssistantController.chat: INTERNAL_ERROR");
      return res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
}
