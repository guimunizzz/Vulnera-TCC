// Traduz as consultas e decisões da fila administrativa para HTTP seguro.
// Existe para validar query/body e não expor linhas Prisma, tokens ou hashes.
// Consumido exclusivamente por admin-access-request.routes.ts.

import type { Request, Response } from "express";
import { AccessInvitationCooldownError } from "../models/access-invitation.model";
import {
  ACCESS_REQUEST_STATUSES,
  type AccessRequestStatus,
  type AccessRequest,
} from "../models/access-request.model";
import {
  AdminAccessRequestEntity,
  type AccessRequestAdminActor,
} from "../models/admin-access-request.model";
import type { AdminAccessRequestQueryService } from "../services/admin-access-request-query.service";
import type { AdminAccessRequestDecisionService } from "../services/admin-access-request-decision.service";
import type { AccessInvitationService } from "../services/access-invitation.service";

export type AdminAccessRequestControllerDependencies = {
  queryService: Pick<AdminAccessRequestQueryService, "list" | "getById" | "events">;
  decisionService: Pick<AdminAccessRequestDecisionService, "approve" | "reject">;
  invitationService: Pick<AccessInvitationService, "resend">;
};

// IDs deste domínio são Prisma CUIDs; a forma genérica também preserva UUIDs
// legados/fixtures. Existência é verificada no service, não no parser.
const ENTITY_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/u;
const MAX_SKIP = 2_147_483_647;

export class AdminAccessRequestController {
  constructor(private readonly dependencies: AdminAccessRequestControllerDependencies) {}

  async list(req: Request, res: Response): Promise<Response> {
    const page = parsePositiveInteger(req.query.page, 1);
    const pageSize = parsePositiveInteger(req.query.pageSize, 20);
    if (page === null) return res.status(400).json({ error: "INVALID_PAGE" });
    if (pageSize === null || pageSize > 100) return res.status(400).json({ error: "INVALID_PAGE_SIZE" });
    if (!hasSupportedOffset(page, pageSize)) return res.status(400).json({ error: "INVALID_PAGE" });
    const status = parseStatus(req.query.status);
    if (status === null) return res.status(400).json({ error: "INVALID_STATUS" });

    try {
      const result = await this.dependencies.queryService.list(actorFrom(req), { page, pageSize, status });
      return res.status(200).json(result);
    } catch (error) {
      return mapError(res, error);
    }
  }

  async getById(req: Request, res: Response): Promise<Response> {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: "INVALID_ID" });
    try {
      return res.status(200).json(await this.dependencies.queryService.getById(id, actorFrom(req)));
    } catch (error) {
      return mapError(res, error);
    }
  }

  async events(req: Request, res: Response): Promise<Response> {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: "INVALID_ID" });
    const page = parsePositiveInteger(req.query.page, 1);
    const pageSize = parsePositiveInteger(req.query.pageSize, 20);
    if (page === null) return res.status(400).json({ error: "INVALID_PAGE" });
    if (pageSize === null || pageSize > 100) return res.status(400).json({ error: "INVALID_PAGE_SIZE" });
    if (!hasSupportedOffset(page, pageSize)) return res.status(400).json({ error: "INVALID_PAGE" });

    try {
      return res.status(200).json(await this.dependencies.queryService.events(id, actorFrom(req), { page, pageSize }));
    } catch (error) {
      return mapError(res, error);
    }
  }

  async approve(req: Request, res: Response): Promise<Response> {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: "INVALID_ID" });
    try {
      const result = await this.dependencies.decisionService.approve(id, actorFrom(req));
      return res.status(200).json({
        request: safeRequest(result.request),
        invitationDelivery: result.invitationDelivery,
      });
    } catch (error) {
      return mapError(res, error);
    }
  }

  async reject(req: Request, res: Response): Promise<Response> {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: "INVALID_ID" });
    const body = bodyRecord(req.body);
    if (req.body !== undefined && body === null) return res.status(400).json({ error: "INVALID_REASON" });
    const reason = parseReason(body?.reason);
    if (reason === INVALID_REASON) return res.status(400).json({ error: "INVALID_REASON" });
    try {
      const result = await this.dependencies.decisionService.reject(id, actorFrom(req), reason);
      return res.status(200).json({ request: safeRequest(result.request) });
    } catch (error) {
      return mapError(res, error);
    }
  }

  async resendInvitation(req: Request, res: Response): Promise<Response> {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: "INVALID_ID" });
    try {
      const result = await this.dependencies.invitationService.resend(id, actorFrom(req));
      return res.status(200).json({
        request: safeRequest(result.request),
        invitationDelivery: result.invitationDelivery,
      });
    } catch (error) {
      return mapError(res, error);
    }
  }
}

const INVALID_REASON = Symbol("INVALID_REASON");
type ParsedReason = string | null | undefined | typeof INVALID_REASON;

function bodyRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function parseReason(value: unknown): ParsedReason {
  if (value === undefined || value === null) return value;
  if (typeof value !== "string") return INVALID_REASON;
  const reason = value.trim();
  if (reason.length > 2_000) return INVALID_REASON;
  return reason || null;
}

function parseId(value: unknown): string | null {
  return typeof value === "string" && ENTITY_ID_PATTERN.test(value) ? value : null;
}

function hasSupportedOffset(page: number, pageSize: number): boolean {
  return Number.isSafeInteger((page - 1) * pageSize) && (page - 1) * pageSize <= MAX_SKIP;
}

function parsePositiveInteger(value: unknown, defaultValue: number): number | null {
  if (value === undefined) return defaultValue;
  if (typeof value !== "string" || !/^[1-9]\d*$/u.test(value)) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : null;
}

function parseStatus(value: unknown): AccessRequestStatus | undefined | null {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !ACCESS_REQUEST_STATUSES.some(status => status === value)) return null;
  return value as AccessRequestStatus;
}

function actorFrom(req: Request): AccessRequestAdminActor {
  if (!req.user) throw new Error("FORBIDDEN");
  return { userId: req.user.userId, role: req.user.role };
}

function safeRequest(request: AccessRequest) {
  return new AdminAccessRequestEntity({
    ...request,
    status: request.status as AccessRequestStatus,
  }).toResponse();
}

function mapError(res: Response, error: unknown): Response {
  if (error instanceof AccessInvitationCooldownError) {
    res.setHeader("Retry-After", String(error.retryAfterSeconds));
    return res.status(429).json({ error: "ACCESS_INVITATION_COOLDOWN" });
  }
  const code = error instanceof Error ? error.message : "";
  if (code === "ACCESS_REQUEST_NOT_FOUND") return res.status(404).json({ error: code });
  if (code === "FORBIDDEN") return res.status(403).json({ error: code });
  if (code === "ACCESS_REQUEST_USER_ALREADY_EXISTS" || code === "USER_ALREADY_EXISTS") {
    return res.status(409).json({ error: "USER_ALREADY_EXISTS" });
  }
  if ([
    "INVALID_STATUS_TRANSITION",
    "ACCESS_REQUEST_EXPIRED",
    "ACCESS_REQUEST_EMAIL_NOT_VERIFIED",
    "ACCESS_INVITATION_ALREADY_USED",
  ].includes(code)) {
    return res.status(422).json({ error: code });
  }
  if (code === "ACCESS_REQUEST_TRANSITION_CONFLICT" || code === "ACCESS_INVITATION_ROTATION_CONFLICT") {
    return res.status(409).json({ error: "ACCESS_REQUEST_TRANSITION_CONFLICT" });
  }
  return res.status(500).json({ error: "INTERNAL_ERROR" });
}
