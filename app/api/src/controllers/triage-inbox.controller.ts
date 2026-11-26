/**
 * triage-inbox.controller.ts
 *
 * Adapta HTTP ↔ TriageInboxService (ADR-062). Sem parâmetros: a caixa é
 * sempre do usuário autenticado. A triagem em si continua nos PATCH de cada
 * fonte.
 *
 * QUEM USA
 * `triage-inbox.routes.ts`, montado pela `triage-inbox.factory.ts`.
 */

import type { Request, Response } from "express";
import type { TriageInboxService } from "../services/triage-inbox.service";

export class TriageInboxController {
  constructor(private readonly service: TriageInboxService) {}

  /** GET /api/triage/inbox */
  async caixa(req: Request, res: Response): Promise<Response> {
    try {
      return res.status(200).json(await this.service.caixa(req.user!));
    } catch (error: unknown) {
      console.error("TriageInboxController.caixa", error);
      return res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
}
