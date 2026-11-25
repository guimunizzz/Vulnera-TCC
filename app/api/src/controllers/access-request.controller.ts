// Traduz os pedidos públicos de acesso entre HTTP e serviço de domínio.
// Mantém validação de entrada e respostas neutras fora das camadas inferiores.
// Consumido exclusivamente pelas rotas de AccessRequest montadas por factory.

import type { Request, Response } from "express";
import { isSingleEmailAddress } from "../models/email.model";
import { normalizeAccessRequestEmail, type CreateAccessRequestDTO } from "../models/access-request.model";

export interface PublicAccessRequestService {
  request(dto: CreateAccessRequestDTO): Promise<void>;
  resend(email: string): Promise<void>;
  confirmEmail(token: string): Promise<boolean>;
}

const NEUTRAL_MESSAGE = "Se os dados informados permitirem, você receberá as instruções por e-mail.";
const CONFIRMED_MESSAGE = "E-mail confirmado.";

export class AccessRequestController {
  constructor(private readonly service: PublicAccessRequestService) {}

  async request(req: Request, res: Response): Promise<Response> {
    const input = parseCreateBody(req.body);
    if (!input.dto) return res.status(400).json({ error: input.error });
    try {
      // Os demais campos do body, inclusive IDs/estado/papel, são ignorados;
      // somente este DTO construído aqui pode chegar ao serviço.
      await this.service.request(input.dto);
      return res.status(202).json({ message: NEUTRAL_MESSAGE });
    } catch {
      return res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }

  async resend(req: Request, res: Response): Promise<Response> {
    const email = parseEmail(readBodyRecord(req.body)?.email);
    if (!email) return res.status(400).json({ error: "INVALID_EMAIL" });
    try {
      await this.service.resend(email);
      return res.status(202).json({ message: NEUTRAL_MESSAGE });
    } catch {
      return res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }

  async verifyEmail(req: Request, res: Response): Promise<Response> {
    const token = readBodyRecord(req.body)?.token;
    if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/u.test(token)) {
      return res.status(400).json({ error: "INVALID_VERIFICATION_TOKEN" });
    }
    try {
      if (!(await this.service.confirmEmail(token))) {
        return res.status(400).json({ error: "INVALID_VERIFICATION_TOKEN" });
      }
      return res.status(200).json({ message: CONFIRMED_MESSAGE });
    } catch {
      return res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
}

type CreateBodyResult = { dto: CreateAccessRequestDTO; error?: never } | { dto?: never; error: string };

function parseCreateBody(body: unknown): CreateBodyResult {
  const record = readBodyRecord(body);
  if (!record) return { error: "INVALID_BODY" };

  const name = parseText(record.name, 191);
  if (!name) return { error: "INVALID_NAME" };
  const companyName = parseText(record.companyName, 191);
  if (!companyName) return { error: "INVALID_COMPANY_NAME" };
  const email = parseEmail(record.email);
  if (!email) return { error: "INVALID_EMAIL" };

  let phone: string | null | undefined;
  if (record.phone !== undefined && record.phone !== null) {
    if (typeof record.phone !== "string") return { error: "INVALID_PHONE" };
    const cleaned = record.phone.trim();
    if (containsControl(record.phone) || cleaned.length > 191) return { error: "INVALID_PHONE" };
    phone = cleaned.length > 0 ? cleaned : null;
  }

  return {
    dto: {
      name,
      companyName,
      email,
      ...(phone !== undefined ? { phone } : {}),
    },
  };
}

function parseText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  if (containsControl(value)) return undefined;
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > maxLength) return undefined;
  return cleaned;
}

function parseEmail(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  if (containsControl(value)) return undefined;
  const normalized = normalizeAccessRequestEmail(value);
  if (normalized.length > 191 || !isSingleEmailAddress(normalized)) return undefined;
  return normalized;
}

function readBodyRecord(body: unknown): Record<string, unknown> | undefined {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return undefined;
  return body as Record<string, unknown>;
}

function containsControl(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 32 || code === 127) return true;
  }
  return false;
}
