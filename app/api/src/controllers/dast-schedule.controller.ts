import type { Request, Response } from "express";
import type { DastScheduleService } from "../services/dast-schedule.service";

/** Erro de domínio → status HTTP. Recurso de outra empresa é 404, não 403 (ADR-053/056). */
const STATUS: Record<string, number> = {
  APPLICATION_NOT_FOUND: 404,
  SCHEDULE_NOT_FOUND: 404,
  PROJECT_NOT_FOUND: 404,
  FORBIDDEN: 403,
  INVALID_UNTIL: 400,
  INVALID_MODE: 400,
  INVALID_FREQUENCY: 400,
  INVALID_HOUR: 400,
  INVALID_MINUTE: 400,
  INVALID_DAY_OF_WEEK: 400,
  INVALID_TIMEZONE: 400,
  INVALID_ENABLED: 400,
  INVALID_PROJECT_ID: 400,
  INVALID_LIMIT: 400,
  MISSING_PROJECT_ID: 400,
  MODE_IS_IMMUTABLE: 400,
  TARGET_IS_IMMUTABLE: 400,
  MISSING_TARGET_URL: 400,
  INVALID_TARGET_URL: 400,
  AUTHORIZATION_CONFIRMATION_REQUIRED: 400,
  PROJECT_IS_IMMUTABLE: 400,
  // Alvo sem autorização válida: o pedido é bem formado, mas a regra o barra.
  APPLICATION_WITHOUT_URL: 422,
  AUTHORIZATION_MISSING: 422,
  AUTHORIZATION_EXPIRED: 422,
  HOST_MISMATCH: 422,
};

export class DastScheduleController {
  constructor(private readonly service: DastScheduleService) {}

  getAuthorization = (req: Request, res: Response) => this.responder(res, "getAuthorization", () => this.service.autorizacao(req.user!, String(req.params.id)));

  authorize = (req: Request, res: Response) =>
    this.responder(res, "authorize", () => this.service.autorizar(req.user!, String(req.params.id), { until: req.body?.until }));

  revoke = (req: Request, res: Response) => this.responder(res, "revoke", () => this.service.revogar(req.user!, String(req.params.id)));

  /** GET /dast-schedules — a página /agendamentos. */
  listAll = (req: Request, res: Response) => this.responder(res, "listAll", () => this.service.listarVisiveis(req.user!));

  /** GET /dast-schedules/targets — aplicações em que dá para agendar. */
  targets = (req: Request, res: Response) => this.responder(res, "targets", () => this.service.alvos(req.user!));

  /** POST /dast-schedules — agendamento só por URL. */
  createByUrl = (req: Request, res: Response) => this.responder(res, "createByUrl", () => this.service.criarPorUrl(req.user!, this.corpo(req)), 201);

  /** PUT/DELETE /dast-schedules/:scheduleId — pela página /agendamentos, para os dois tipos. */
  updateById = (req: Request, res: Response) =>
    this.responder(res, "updateById", () => this.service.atualizarPorId(req.user!, String(req.params.scheduleId), this.corpo(req)));

  removeById = (req: Request, res: Response) => this.responder(res, "removeById", () => this.service.removerPorId(req.user!, String(req.params.scheduleId)), 204);

  /** POST /dast-schedules/:scheduleId/run — "Rodar agora". */
  run = (req: Request, res: Response) => this.responder(res, "run", () => this.service.rodarAgora(req.user!, String(req.params.scheduleId)));

  /** GET /dast-schedules/:scheduleId/history?limit=10 — últimas execuções com o diff. */
  history = (req: Request, res: Response) =>
    this.responder(res, "history", () => this.service.historico(req.user!, String(req.params.scheduleId), req.query.limit));

  list = (req: Request, res: Response) => this.responder(res, "list", () => this.service.listar(req.user!, String(req.params.id)));

  create = (req: Request, res: Response) =>
    this.responder(res, "create", () => this.service.criar(req.user!, String(req.params.id), this.corpo(req)), 201);

  update = (req: Request, res: Response) =>
    this.responder(res, "update", () => this.service.atualizar(req.user!, String(req.params.id), String(req.params.scheduleId), this.corpo(req)));

  remove = (req: Request, res: Response) =>
    this.responder(res, "remove", () => this.service.remover(req.user!, String(req.params.id), String(req.params.scheduleId)), 204);

  /** Só os campos conhecidos passam — companyId/createdById do corpo são ignorados (SEC2). */
  private corpo(req: Request) {
    const b = (req.body ?? {}) as Record<string, unknown>;
    return {
      mode: b.mode,
      targetUrl: b.targetUrl,
      confirmedAuthorization: b.confirmedAuthorization,
      projectId: b.projectId,
      enabled: b.enabled,
      frequency: b.frequency as never,
      hour: b.hour as never,
      minute: b.minute as never,
      dayOfWeek: b.dayOfWeek as never,
      timezone: b.timezone as never,
    };
  }

  private async responder(res: Response, acao: string, fn: () => Promise<unknown>, sucesso = 200): Promise<Response> {
    try {
      const corpo = await fn();
      return sucesso === 204 ? res.status(204).send() : res.status(sucesso).json(corpo);
    } catch (error: any) {
      const status = STATUS[error?.message];
      if (status) return res.status(status).json({ error: error.message });
      console.error(`DastScheduleController.${acao}`, error);
      return res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
}
