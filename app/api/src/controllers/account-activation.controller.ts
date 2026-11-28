// Adapta os endpoints públicos de ativação ao serviço de domínio.
// Existe para validar apenas token e senha e devolver erros sem dados pessoais.
// Consumido pelas rotas de ativação montadas pela factory do recurso.

import type { Request, Response } from "express";
import { isValidAccountActivationToken } from "../models/account-activation.model";
import type { AccountActivationService } from "../services/account-activation.service";

export type AccountActivationControllerService = Pick<AccountActivationService, "validate" | "activate">;

const MIN_PASSWORD_LENGTH = 8;
const MAX_BCRYPT_PASSWORD_BYTES = 72;

export class AccountActivationController {
  constructor(private readonly service: AccountActivationControllerService) {}

  async validate(req: Request, res: Response): Promise<Response> {
    res.setHeader("Cache-Control", "no-store");
    const input = readTokenBody(req.body);
    if (input.error !== undefined) return res.status(input.status).json({ error: input.error });

    try {
      const result = await this.service.validate(input.token);
      if (typeof result?.valid !== "boolean") throw new Error("ACCOUNT_ACTIVATION_FAILED");
      return res.status(200).json({ valid: result.valid });
    } catch {
      return res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }

  async activate(req: Request, res: Response): Promise<Response> {
    res.setHeader("Cache-Control", "no-store");
    const input = readActivationBody(req.body);
    if (input.error !== undefined) return res.status(input.status).json({ error: input.error });

    try {
      await this.service.activate(input.token, input.password);
      return res.status(204).send();
    } catch (error) {
      if (hasCode(error, "INVALID_ACTIVATION_TOKEN")) {
        return res.status(400).json({ error: "INVALID_ACTIVATION_TOKEN" });
      }
      if (error instanceof Error && [
        "ACCESS_REQUEST_PLAN_NOT_FOUND",
        "ACCESS_REQUEST_PLAN_UNAVAILABLE",
        "ACCESS_REQUEST_PLAN_CHANGED",
        "COMPANY_ALREADY_EXISTS",
      ].includes(error.message)) {
        return res.status(409).json({ error: error.message });
      }
      return res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
}

type ParsedToken = { token: string; error?: never; status?: never } | { token?: never; error: string; status: number };
type ParsedActivation = { token: string; password: string; error?: never; status?: never }
  | { token?: never; password?: never; error: string; status: number };

function readTokenBody(body: unknown): ParsedToken {
  const record = bodyRecord(body);
  if (!record || !hasOnlyKeys(record, ["token"])) return { error: "INVALID_BODY", status: 400 };
  if (!isValidAccountActivationToken(record.token)) {
    return { error: "INVALID_ACTIVATION_TOKEN", status: 400 };
  }
  return { token: record.token };
}

function readActivationBody(body: unknown): ParsedActivation {
  const record = bodyRecord(body);
  if (!record || !hasOnlyKeys(record, ["token", "password"])) return { error: "INVALID_BODY", status: 400 };
  if (!isValidAccountActivationToken(record.token)) {
    return { error: "INVALID_ACTIVATION_TOKEN", status: 400 };
  }
  if (typeof record.password !== "string") return { error: "INVALID_PASSWORD", status: 400 };
  if (record.password.length < MIN_PASSWORD_LENGTH) return { error: "WEAK_PASSWORD", status: 400 };
  if (Buffer.byteLength(record.password, "utf8") > MAX_BCRYPT_PASSWORD_BYTES) {
    return { error: "INVALID_PASSWORD", status: 400 };
  }
  return { token: record.token, password: record.password };
}

function bodyRecord(body: unknown): Record<string, unknown> | undefined {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return undefined;
  return body as Record<string, unknown>;
}

function hasOnlyKeys(record: Record<string, unknown>, keys: string[]): boolean {
  const allowed = new Set(keys);
  return Object.keys(record).every((key) => allowed.has(key));
}

function hasCode(error: unknown, code: string): boolean {
  return error instanceof Error && error.message === code;
}
