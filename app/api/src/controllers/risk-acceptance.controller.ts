/**
 * risk-acceptance.controller.ts
 *
 * Adapta HTTP ↔ RiskAcceptanceService (CP-4).
 *
 * Validação de SHAPE aqui (o campo veio? é string? a data parseia?); as
 * regras de tamanho, prazo e alçada moram no service, que é quem as conhece —
 * os códigos de erro são os mesmos nos dois lados, de propósito.
 *
 * ⚠️ NÃO EXISTE `update`. Um aceite decidido é imutável (D10): as únicas
 * escritas são as transições nomeadas. Um PUT genérico seria a porta por onde
 * alguém reescreveria a justificativa depois da assinatura.
 */

import type { Request, Response } from "express";
import type { RiskAcceptanceService } from "../services/risk-acceptance.service";

/** Data ISO obrigatória/opcional do corpo. `undefined` ausente, `null` inválida. */
function lerData(raw: unknown): Date | undefined | null {
  if (raw === undefined || raw === null || raw === "") return undefined;
  if (typeof raw !== "string") return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function traduzirErro(res: Response, error: any, origem: string): Response {
  const map: Record<string, number> = {
    VULNERABILITY_NOT_FOUND: 404,
    RISK_ACCEPTANCE_NOT_FOUND: 404,
    FORBIDDEN: 403,
    CANNOT_APPROVE_OWN_REQUEST: 403,
    RISK_ACCEPTANCE_ALREADY_ACTIVE: 409,
    INVALID_STATUS_TRANSITION: 422,
    INVALID_REASON: 400,
    INVALID_BUSINESS_JUSTIFICATION: 400,
    INVALID_COMPENSATING_CONTROLS: 400,
    INVALID_EXPIRES_AT: 400,
    EXPIRES_AT_EXCEEDS_REQUESTED: 400,
    INVALID_REVIEW_NOTE: 400,
    MISSING_REVIEW_NOTE: 400,
  };
  const status = map[error?.message];
  if (status) return res.status(status).json({ error: error.message });
  console.error(`RiskAcceptanceController.${origem}`, error);
  return res.status(500).json({ error: "INTERNAL_ERROR" });
}

export class RiskAcceptanceController {
  constructor(private readonly service: RiskAcceptanceService) {}

  /** GET /api/vulnerabilities/:id/risk-acceptances — histórico completo. */
  async list(req: Request, res: Response): Promise<Response> {
    try {
      const lista = await this.service.listByVulnerability(req.user!, req.params.id as string);
      return res.status(200).json(lista);
    } catch (error: any) {
      return traduzirErro(res, error, "list");
    }
  }

  /** POST /api/vulnerabilities/:id/risk-acceptances — solicita. */
  async request(req: Request, res: Response): Promise<Response> {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      if (typeof body.reason !== "string") return res.status(400).json({ error: "INVALID_REASON" });
      if (typeof body.businessJustification !== "string") {
        return res.status(400).json({ error: "INVALID_BUSINESS_JUSTIFICATION" });
      }
      if (body.compensatingControls !== undefined && body.compensatingControls !== null && typeof body.compensatingControls !== "string") {
        return res.status(400).json({ error: "INVALID_COMPENSATING_CONTROLS" });
      }
      const requestedExpiresAt = lerData(body.requestedExpiresAt);
      if (requestedExpiresAt === null) return res.status(400).json({ error: "INVALID_EXPIRES_AT" });

      const criado = await this.service.request(req.user!, req.params.id as string, {
        reason: body.reason,
        businessJustification: body.businessJustification,
        compensatingControls: (body.compensatingControls as string | null | undefined) ?? null,
        requestedExpiresAt: requestedExpiresAt ?? null,
      });
      return res.status(201).json(criado);
    } catch (error: any) {
      return traduzirErro(res, error, "request");
    }
  }

  /** POST /api/risk-acceptances/:id/approve */
  async approve(req: Request, res: Response): Promise<Response> {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const expiresAt = lerData(body.expiresAt);
      if (expiresAt === null || expiresAt === undefined) return res.status(400).json({ error: "INVALID_EXPIRES_AT" });
      if (body.reviewNote !== undefined && body.reviewNote !== null && typeof body.reviewNote !== "string") {
        return res.status(400).json({ error: "INVALID_REVIEW_NOTE" });
      }
      const atualizado = await this.service.approve(req.user!, req.params.id as string, {
        expiresAt,
        reviewNote: (body.reviewNote as string | null | undefined) ?? null,
      });
      return res.status(200).json(atualizado);
    } catch (error: any) {
      return traduzirErro(res, error, "approve");
    }
  }

  /** POST /api/risk-acceptances/:id/reject */
  async reject(req: Request, res: Response): Promise<Response> {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      if (typeof body.reviewNote !== "string") return res.status(400).json({ error: "MISSING_REVIEW_NOTE" });
      const atualizado = await this.service.reject(req.user!, req.params.id as string, { reviewNote: body.reviewNote });
      return res.status(200).json(atualizado);
    } catch (error: any) {
      return traduzirErro(res, error, "reject");
    }
  }

  /** POST /api/risk-acceptances/:id/revoke */
  async revoke(req: Request, res: Response): Promise<Response> {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      if (typeof body.reason !== "string") return res.status(400).json({ error: "INVALID_REASON" });
      const atualizado = await this.service.revoke(req.user!, req.params.id as string, { reason: body.reason });
      return res.status(200).json(atualizado);
    } catch (error: any) {
      return traduzirErro(res, error, "revoke");
    }
  }
}
