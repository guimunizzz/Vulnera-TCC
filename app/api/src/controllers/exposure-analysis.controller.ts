/**
 * exposure-analysis.controller.ts
 *
 * O QUE FAZ
 * Adapta HTTP ↔ ExposureAnalysisService (ADR-061): combinações tóxicas, raio
 * de impacto (opções e resultado) e histórico da exposição. O escopo vem do
 * usuário autenticado; a única entrada é `tipo`/`valor` do raio de impacto,
 * validada no service.
 *
 * QUEM USA
 * `company.routes.ts` (GET /api/companies/me/exposure-graph/...). Montado pela
 * `exposure-analysis.factory.ts`.
 */

import type { Request, Response } from "express";
import type { ExposureAnalysisService } from "../services/exposure-analysis.service";

const ERROS: Record<string, number> = {
  COMPANY_NOT_FOUND: 404,
  INVALID_IMPACT_TYPE: 400,
  INVALID_IMPACT_VALUE: 400,
};

export class ExposureAnalysisController {
  constructor(private readonly service: ExposureAnalysisService) {}

  /** GET /api/companies/me/exposure-graph/toxic-combinations */
  async combinacoesToxicas(req: Request, res: Response): Promise<Response> {
    return this.responder(res, "combinacoesToxicas", () => this.service.combinacoesToxicas(req.user!));
  }

  /** GET /api/companies/me/exposure-graph/blast-radius/options */
  async opcoesDeImpacto(req: Request, res: Response): Promise<Response> {
    return this.responder(res, "opcoesDeImpacto", () => this.service.opcoesDeImpacto(req.user!));
  }

  /** GET /api/companies/me/exposure-graph/blast-radius?tipo=PACOTE|CVE|CATEGORIA&valor=... */
  async impacto(req: Request, res: Response): Promise<Response> {
    return this.responder(res, "impacto", () => this.service.impacto(req.user!, req.query.tipo, req.query.valor));
  }

  /** GET /api/companies/me/exposure-graph/history */
  async historico(req: Request, res: Response): Promise<Response> {
    return this.responder(res, "historico", () => this.service.historico(req.user!));
  }

  private async responder(res: Response, acao: string, executar: () => Promise<unknown>): Promise<Response> {
    try {
      return res.status(200).json(await executar());
    } catch (error: unknown) {
      const codigo = error instanceof Error ? error.message : String(error);
      const status = ERROS[codigo];
      if (status) return res.status(status).json({ error: codigo });
      console.error(`ExposureAnalysisController.${acao}`, error);
      return res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
}
