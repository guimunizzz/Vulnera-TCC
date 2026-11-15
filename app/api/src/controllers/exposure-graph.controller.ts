/**
 * exposure-graph.controller.ts
 *
 * O QUE FAZ
 * Adapta HTTP ↔ ExposureGraphService. Este endpoint não recebe parâmetros: o
 * escopo vem inteiro do usuário autenticado, então não há query string para
 * validar. O controller chama o service e traduz o código de erro para status.
 *
 * QUEM USA
 * `company.routes.ts` (GET /api/companies/me/exposure-graph). Montado pela
 * `exposure-graph.factory.ts`.
 */

import type { Request, Response } from "express";
import type { ExposureGraphService } from "../services/exposure-graph.service";

export class ExposureGraphController {
  constructor(private readonly service: ExposureGraphService) {}

  /** GET /api/companies/me/exposure-graph */
  async get(req: Request, res: Response): Promise<Response> {
    try {
      const dados = await this.service.getGraph(req.user!);
      return res.status(200).json(dados);
    } catch (error: unknown) {
      return this.traduzirErro(error, res);
    }
  }

  private traduzirErro(error: unknown, res: Response): Response {
    const mensagem = error instanceof Error ? error.message : String(error);

    if (mensagem === "COMPANY_NOT_FOUND") return res.status(404).json({ error: "COMPANY_NOT_FOUND" });

    console.error("ExposureGraphController.get", error);
    return res.status(500).json({ error: "INTERNAL_ERROR" });
  }
}
