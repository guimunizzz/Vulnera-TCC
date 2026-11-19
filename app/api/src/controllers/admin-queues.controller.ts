/**
 * admin-queues.controller.ts
 *
 * HTTP do painel de filas (ADR-056). Lê a rota, chama o service e traduz
 * código de erro da aplicação em status. Sem regra de negócio.
 */

import type { Request, Response } from "express";
import type { QueueAdminService } from "../services/queue-admin.service";

const STATUS: Record<string, number> = {
  INVALID_QUEUE: 400,
  JOB_NOT_FOUND: 404,
  JOB_NOT_FAILED: 409,
  QUEUE_DRIVER_MEMORY: 409,
};

export class AdminQueuesController {
  constructor(private readonly service: QueueAdminService) {}

  /** GET /admin/queues — contagens e últimas falhas de cada fila. */
  painel = (req: Request, res: Response) => this.responder(res, "painel", () => this.service.painel());

  /** POST /admin/queues/:name/jobs/:id/retry — reprocessa um job com falha. */
  reprocessar = (req: Request, res: Response) =>
    this.responder(res, "reprocessar", () => this.service.reprocessar(req.user!.userId, String(req.params.name), String(req.params.id)));

  private async responder(res: Response, acao: string, fn: () => Promise<unknown>): Promise<Response> {
    try {
      return res.status(200).json(await fn());
    } catch (error: any) {
      const status = STATUS[error?.message];
      if (status) return res.status(status).json({ error: error.message });
      console.error(`AdminQueuesController.${acao}`, error);
      return res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
}
