// Adapta rotas públicas e de gestão de equipe aos serviços de convite.
// Valida allowlists antes do service e nunca serializa tokenHash ou segredo.
import type { Request, Response } from "express";
import { isSingleEmailAddress } from "../models/email.model";
import { isValidCompanyInvitationToken } from "../utils/company-invitation-token.util";
import type { CreateCompanyInvitationDTO } from "../models/company-invitation.model";
import type { CompanyInvitationService } from "../services/company-invitation.service";
import { CompanyInvitationCooldownError } from "../services/company-invitation.service";
import { CompanyInvitationRateLimitError } from "../services/company-invitation-rate-limit.service";

export type CompanyInvitationControllerService = Pick<CompanyInvitationService,
  | "listMembers"
  | "listInvitations"
  | "listInvitationHistory"
  | "createInvitation"
  | "resendInvitation"
  | "revokeInvitation"
  | "deactivateMember"
  | "validate"
  | "activate"
>;

const MIN_PASSWORD_LENGTH = 8;
const MAX_BCRYPT_PASSWORD_BYTES = 72;
const MAX_NAME_LENGTH = 191;

export class CompanyInvitationController {
  constructor(private readonly service: CompanyInvitationControllerService) {}

  async listMembers(req: Request, res: Response): Promise<Response> {
    try {
      return res.status(200).json(await this.service.listMembers(actor(req)));
    } catch (error) {
      return sendServiceError("listMembers", error, res);
    }
  }

  async listInvitations(req: Request, res: Response): Promise<Response> {
    try {
      return res.status(200).json(await this.service.listInvitations(actor(req)));
    } catch (error) {
      return sendServiceError("listInvitations", error, res);
    }
  }

  async listInvitationHistory(req: Request, res: Response): Promise<Response> {
    try {
      return res.status(200).json(await this.service.listInvitationHistory(actor(req)));
    } catch (error) {
      return sendServiceError("listInvitationHistory", error, res);
    }
  }

  async createInvitation(req: Request, res: Response): Promise<Response> {
    const input = readCreateBody(req.body);
    if (!input.ok) return res.status(400).json({ error: input.error });
    try {
      const result = await this.service.createInvitation(actor(req), input.value);
      return res.status(201).json(result);
    } catch (error) {
      return sendServiceError("createInvitation", error, res);
    }
  }

  async resendInvitation(req: Request, res: Response): Promise<Response> {
    const id = readPathId(req.params.invitationId);
    if (!id) return res.status(400).json({ error: "INVALID_INVITATION_ID" });
    try {
      return res.status(200).json(await this.service.resendInvitation(actor(req), id));
    } catch (error) {
      return sendServiceError("resendInvitation", error, res);
    }
  }

  async revokeInvitation(req: Request, res: Response): Promise<Response> {
    const id = readPathId(req.params.invitationId);
    if (!id) return res.status(400).json({ error: "INVALID_INVITATION_ID" });
    try {
      await this.service.revokeInvitation(actor(req), id);
      return res.status(204).send();
    } catch (error) {
      return sendServiceError("revokeInvitation", error, res);
    }
  }

  async deactivateMember(req: Request, res: Response): Promise<Response> {
    const id = readPathId(req.params.userId);
    if (!id) return res.status(400).json({ error: "INVALID_USER_ID" });
    try {
      await this.service.deactivateMember(actor(req), id);
      return res.status(204).send();
    } catch (error) {
      return sendServiceError("deactivateMember", error, res);
    }
  }

  async validate(req: Request, res: Response): Promise<Response> {
    res.setHeader("Cache-Control", "no-store");
    const input = readTokenBody(req.body);
    if (!input.ok) return res.status(400).json({ error: input.error });
    try {
      const result = await this.service.validate(input.value);
      if (typeof result?.valid !== "boolean") throw new Error("INVALID_VALIDATION_RESPONSE");
      return res.status(200).json({ valid: result.valid });
    } catch {
      return res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }

  async activate(req: Request, res: Response): Promise<Response> {
    res.setHeader("Cache-Control", "no-store");
    const input = readActivationBody(req.body);
    if (!input.ok) return res.status(400).json({ error: input.error });
    try {
      await this.service.activate(input.value.token, input.value.password);
      return res.status(204).send();
    } catch (error) {
      if (hasCode(error, "INVALID_COMPANY_INVITATION")) {
        return res.status(400).json({ error: "INVALID_COMPANY_INVITATION" });
      }
      return res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
}

type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

function readCreateBody(body: unknown): ParseResult<CreateCompanyInvitationDTO> {
  const record = bodyRecord(body);
  if (!record || !hasOnlyKeys(record, ["name", "email"])) return { ok: false, error: "INVALID_BODY" };
  if (typeof record.name !== "string" || !record.name.trim() || record.name.trim().length > MAX_NAME_LENGTH || containsAsciiControl(record.name)) {
    return { ok: false, error: "INVALID_NAME" };
  }
  if (typeof record.email !== "string" || record.email.length > 191 || !isSingleEmailAddress(record.email.trim())) {
    return { ok: false, error: "INVALID_EMAIL" };
  }
  return { ok: true, value: { name: record.name.trim(), email: record.email.trim() } };
}

function readTokenBody(body: unknown): ParseResult<string> {
  const record = bodyRecord(body);
  if (!record || !hasOnlyKeys(record, ["token"])) return { ok: false, error: "INVALID_BODY" };
  if (!isValidCompanyInvitationToken(record.token)) return { ok: false, error: "INVALID_COMPANY_INVITATION" };
  return { ok: true, value: record.token };
}

function readActivationBody(body: unknown): ParseResult<{ token: string; password: string }> {
  const record = bodyRecord(body);
  if (!record || !hasOnlyKeys(record, ["token", "password"])) return { ok: false, error: "INVALID_BODY" };
  if (!isValidCompanyInvitationToken(record.token)) return { ok: false, error: "INVALID_COMPANY_INVITATION" };
  if (typeof record.password !== "string") return { ok: false, error: "INVALID_PASSWORD" };
  if (record.password.length < MIN_PASSWORD_LENGTH) return { ok: false, error: "WEAK_PASSWORD" };
  if (Buffer.byteLength(record.password, "utf8") > MAX_BCRYPT_PASSWORD_BYTES) return { ok: false, error: "INVALID_PASSWORD" };
  return { ok: true, value: { token: record.token, password: record.password } };
}

function actor(req: Request): { userId: string } {
  return { userId: req.user!.userId };
}

function readPathId(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 && value.length <= 191 ? value : undefined;
}

function bodyRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function hasOnlyKeys(record: Record<string, unknown>, keys: string[]): boolean {
  const allowed = new Set(keys);
  return Object.keys(record).every(key => allowed.has(key));
}

function containsAsciiControl(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 32 || code === 127) return true;
  }
  return false;
}

function sendServiceError(method: string, error: unknown, res: Response): Response {
  if (error instanceof CompanyInvitationRateLimitError || error instanceof CompanyInvitationCooldownError) {
    res.setHeader("Retry-After", String(error.retryAfterSeconds));
    return res.status(429).json({ error: error.message, retryAfterSeconds: error.retryAfterSeconds });
  }

  const code = error instanceof Error ? error.message : "";
  const status: Record<string, number> = {
    FORBIDDEN: 403,
    COMPANY_NOT_FOUND: 404,
    COMPANY_MEMBER_NOT_FOUND: 404,
    COMPANY_INVITATION_NOT_FOUND: 404,
    COMPANY_INVITATION_NOT_AVAILABLE: 409,
    COMPANY_INVITATION_ALREADY_USED: 409,
    COMPANY_INVITATION_NOT_PENDING: 409,
    COMPANY_SUBSCRIPTION_NOT_ACTIVE: 422,
  };
  if (code in status) return res.status(status[code]).json({ error: code });
  console.error(`[CompanyInvitationController.${method}] erro inesperado`, error);
  return res.status(500).json({ error: "INTERNAL_ERROR" });
}

function hasCode(error: unknown, code: string): boolean {
  return error instanceof Error && error.message === code;
}
