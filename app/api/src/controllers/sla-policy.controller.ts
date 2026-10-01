/**
 * sla-policy.controller.ts
 *
 * Adapta HTTP ↔ SlaPolicyService (CP-2). Montado como sub-rota de
 * /companies/:id — a política é um atributo de governança da empresa, e é
 * pelo id da empresa que ADMIN e CLIENT OWNER a encontram.
 *
 * Validação de shape aqui (são inteiros? existem os quatro?); a regra de
 * faixa (1..365) mora no service, que é quem a conhece — o código de erro
 * INVALID_SLA_DAYS é o mesmo nos dois lugares, de propósito.
 */

import type { Request, Response } from "express";
import type { SlaPolicyService } from "../services/sla-policy.service";
import type { UpsertSlaPolicyDTO } from "../models/sla-policy.model";

const DIAS = ["criticalDays", "highDays", "mediumDays", "lowDays"] as const;

function traduzirErro(res: Response, error: any, origem: string): Response {
  if (error.message === "FORBIDDEN") return res.status(403).json({ error: "FORBIDDEN" });
  if (error.message === "COMPANY_NOT_FOUND") return res.status(404).json({ error: "COMPANY_NOT_FOUND" });
  if (error.message === "INVALID_SLA_DAYS") return res.status(400).json({ error: "INVALID_SLA_DAYS" });
  console.error(`SlaPolicyController.${origem}`, error);
  return res.status(500).json({ error: "INTERNAL_ERROR" });
}

export class SlaPolicyController {
  constructor(private readonly service: SlaPolicyService) {}

  /** GET /api/companies/:id/sla-policy — a vigente (própria ou padrão). */
  async get(req: Request, res: Response): Promise<Response> {
    try {
      const policy = await this.service.getForCompany(req.user!, req.params.id as string);
      return res.status(200).json(policy.toResponse());
    } catch (error: any) {
      return traduzirErro(res, error, "get");
    }
  }

  /** GET /api/companies/:id/sla-policy/history — todas as versões da empresa. */
  async history(req: Request, res: Response): Promise<Response> {
    try {
      const policies = await this.service.history(req.user!, req.params.id as string);
      return res.status(200).json(policies.map((p) => p.toResponse()));
    } catch (error: any) {
      return traduzirErro(res, error, "history");
    }
  }

  /** PUT /api/companies/:id/sla-policy — versiona (desativa a atual, cria a nova). */
  async upsert(req: Request, res: Response): Promise<Response> {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      // 🚧 [FUTURO] migrar pra zod
      for (const campo of DIAS) {
        if (typeof body[campo] !== "number" || !Number.isFinite(body[campo] as number)) {
          return res.status(400).json({ error: "INVALID_SLA_DAYS" });
        }
      }
      if (body.name !== undefined && (typeof body.name !== "string" || body.name.length > 120)) {
        return res.status(400).json({ error: "INVALID_NAME" });
      }
      const dto: UpsertSlaPolicyDTO = {
        name: body.name as string | undefined,
        criticalDays: body.criticalDays as number,
        highDays: body.highDays as number,
        mediumDays: body.mediumDays as number,
        lowDays: body.lowDays as number,
      };
      const policy = await this.service.upsert(req.user!, req.params.id as string, dto);
      return res.status(200).json(policy.toResponse());
    } catch (error: any) {
      return traduzirErro(res, error, "upsert");
    }
  }

  /** POST /api/companies/:id/sla-policy/apply — recalcula os findings ativos (ADMIN). */
  async apply(req: Request, res: Response): Promise<Response> {
    try {
      const resultado = await this.service.applyToOpen(req.user!, req.params.id as string);
      return res.status(200).json(resultado);
    } catch (error: any) {
      return traduzirErro(res, error, "apply");
    }
  }
}
