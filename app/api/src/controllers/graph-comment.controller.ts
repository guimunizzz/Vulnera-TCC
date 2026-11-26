/**
 * graph-comment.controller.ts
 *
 * O QUE FAZ
 * Adapta HTTP ↔ GraphCommentService (ADR-061). O controller não valida o
 * escopo: só repassa `grafo`/`escopo` da query (leitura) e o corpo (criação);
 * quem decide o acesso é o service, com a regra de cada grafo.
 *
 * QUEM USA
 * `graph-comment.routes.ts`, montado pela `graph-comment.factory.ts`.
 */

import type { Request, Response } from "express";
import type { GraphCommentService } from "../services/graph-comment.service";

const ERROS: Record<string, number> = {
  INVALID_GRAPH_KIND: 400,
  MISSING_SCOPE: 400,
  MISSING_NODE_ID: 400,
  INVALID_NODE_ID: 400,
  MISSING_COMMENT_BODY: 400,
  INVALID_COMMENT_BODY: 400,
  FORBIDDEN: 403,
  COMPANY_NOT_FOUND: 404,
  SCAN_NOT_FOUND: 404,
  COMMENT_NOT_FOUND: 404,
};

export class GraphCommentController {
  constructor(private readonly service: GraphCommentService) {}

  /** GET /api/graph-comments?grafo=EXPOSURE|DAST_SCAN&escopo=<scanId> */
  async listar(req: Request, res: Response): Promise<Response> {
    return this.responder(res, 200, "listar", () => this.service.listar(req.user!, req.query.grafo, req.query.escopo));
  }

  /** POST /api/graph-comments  { grafo, escopo?, noId, texto, rotulo? } */
  async criar(req: Request, res: Response): Promise<Response> {
    return this.responder(res, 201, "criar", () => this.service.criar(req.user!, req.body));
  }

  /** DELETE /api/graph-comments/:id */
  async apagar(req: Request, res: Response): Promise<Response> {
    try {
      await this.service.apagar(req.user!, String(req.params.id));
      return res.status(204).send();
    } catch (error: unknown) {
      return this.erro(res, "apagar", error);
    }
  }

  private async responder(res: Response, status: number, acao: string, executar: () => Promise<unknown>): Promise<Response> {
    try {
      return res.status(status).json(await executar());
    } catch (error: unknown) {
      return this.erro(res, acao, error);
    }
  }

  private erro(res: Response, acao: string, error: unknown): Response {
    const codigo = error instanceof Error ? error.message : String(error);
    const status = ERROS[codigo];
    if (status) return res.status(status).json({ error: codigo });
    console.error(`GraphCommentController.${acao}`, error);
    return res.status(500).json({ error: "INTERNAL_ERROR" });
  }
}
