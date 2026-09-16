import type { Request, Response } from "express";
import type { ApplicationService } from "../services/application.service";
import {
  CRITICALITIES,
  DATA_SENSITIVITIES,
  ENVIRONMENTS,
  type CreateApplicationDTO,
  type UpdateApplicationDTO,
} from "../models/application.model";

const URL_REGEX = /^https?:\/\/[^\s]+$/;

/** Teto dos campos de texto livre do contexto (donos) — cabe num VARCHAR(191). */
const MAX_OWNER_LENGTH = 180;

/**
 * Valida os campos do contexto de risco (CP-1) presentes no corpo.
 * Devolve o código de erro ou null. Campo ausente = não validado (é PATCH
 * semântico: só o que vier é conferido). `null` nos donos é aceito — é como
 * se limpa o campo.
 */
function validarContextoDeRisco(body: Record<string, unknown>): string | null {
  if (body.environment !== undefined && !ENVIRONMENTS.includes(body.environment as never)) return "INVALID_ENVIRONMENT";
  if (body.criticality !== undefined && !CRITICALITIES.includes(body.criticality as never)) return "INVALID_CRITICALITY";
  if (body.internetFacing !== undefined && typeof body.internetFacing !== "boolean") return "INVALID_INTERNET_FACING";
  if (body.dataSensitivity !== undefined && !DATA_SENSITIVITIES.includes(body.dataSensitivity as never)) {
    return "INVALID_DATA_SENSITIVITY";
  }
  for (const campo of ["businessOwner", "technicalOwner"] as const) {
    const v = body[campo];
    if (v === undefined || v === null) continue;
    if (typeof v !== "string" || v.length > MAX_OWNER_LENGTH) {
      return campo === "businessOwner" ? "INVALID_BUSINESS_OWNER" : "INVALID_TECHNICAL_OWNER";
    }
  }
  return null;
}

/** Só os campos conhecidos passam adiante — nada de `companyId`/`isActive` vindo do corpo. */
function extrairDto(body: Record<string, unknown>): UpdateApplicationDTO {
  const dto: UpdateApplicationDTO = {};
  if (body.name !== undefined) dto.name = body.name as string;
  if (body.url !== undefined) dto.url = body.url as string;
  if (body.environment !== undefined) dto.environment = body.environment as string;
  if (body.techStack !== undefined) dto.techStack = body.techStack as string;
  if (body.description !== undefined) dto.description = body.description as string;
  if (body.criticality !== undefined) dto.criticality = body.criticality as string;
  if (body.internetFacing !== undefined) dto.internetFacing = body.internetFacing as boolean;
  if (body.dataSensitivity !== undefined) dto.dataSensitivity = body.dataSensitivity as string;
  if (body.businessOwner !== undefined) dto.businessOwner = body.businessOwner as string | null;
  if (body.technicalOwner !== undefined) dto.technicalOwner = body.technicalOwner as string | null;
  return dto;
}

export class ApplicationController {
  constructor(private readonly service: ApplicationService) {}

  async list(req: Request, res: Response): Promise<Response> {
    try {
      const actor = req.user!;
      const applications = await this.service.list(actor);
      return res.status(200).json(applications.map((a) => a.toResponse()));
    } catch (error: any) {
      if (error.message === "FORBIDDEN") return res.status(403).json({ error: "FORBIDDEN" });
      console.error("ApplicationController.list", error);
      return res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }

  async getById(req: Request, res: Response): Promise<Response> {
    try {
      const id = req.params.id as string;
      if (!id) return res.status(400).json({ error: "MISSING_ID" });
      const actor = req.user!;
      const application = await this.service.getById(actor, id);
      return res.status(200).json(application.toResponse());
    } catch (error: any) {
      if (error.message === "APPLICATION_NOT_FOUND") return res.status(404).json({ error: "APPLICATION_NOT_FOUND" });
      if (error.message === "FORBIDDEN") return res.status(403).json({ error: "FORBIDDEN" });
      console.error("ApplicationController.getById", error);
      return res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }

  async create(req: Request, res: Response): Promise<Response> {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;

      // 🚧 [FUTURO] migrar pra zod
      if (!body.name || typeof body.name !== "string") {
        return res.status(400).json({ error: "INVALID_NAME" });
      }
      if (body.url !== undefined && (typeof body.url !== "string" || !URL_REGEX.test(body.url))) {
        return res.status(400).json({ error: "INVALID_URL" });
      }
      const erroContexto = validarContextoDeRisco(body);
      if (erroContexto) return res.status(400).json({ error: erroContexto });

      const dto = extrairDto(body) as CreateApplicationDTO;

      const actor = req.user!;
      const application = await this.service.create(actor, dto);
      return res.status(201).json(application.toResponse());
    } catch (error: any) {
      if (error.message === "USER_HAS_NO_COMPANY") return res.status(404).json({ error: "USER_HAS_NO_COMPANY" });
      if (error.message === "NO_ACTIVE_SUBSCRIPTION") return res.status(422).json({ error: "NO_ACTIVE_SUBSCRIPTION" });
      if (error.message === "PLAN_NOT_FOUND") return res.status(404).json({ error: "PLAN_NOT_FOUND" });
      if (error.message === "PLAN_LIMIT_REACHED") return res.status(422).json({ error: "PLAN_LIMIT_REACHED" });
      if (error.message === "FORBIDDEN") return res.status(403).json({ error: "FORBIDDEN" });
      console.error("ApplicationController.create", error);
      return res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }

  async update(req: Request, res: Response): Promise<Response> {
    try {
      const id = req.params.id as string;
      const body = (req.body ?? {}) as Record<string, unknown>;

      if (body.name !== undefined && (typeof body.name !== "string" || !body.name)) {
        return res.status(400).json({ error: "INVALID_NAME" });
      }
      if (body.url !== undefined && (typeof body.url !== "string" || !URL_REGEX.test(body.url))) {
        return res.status(400).json({ error: "INVALID_URL" });
      }
      const erroContexto = validarContextoDeRisco(body);
      if (erroContexto) return res.status(400).json({ error: erroContexto });

      const actor = req.user!;
      const application = await this.service.update(actor, id, extrairDto(body));
      return res.status(200).json(application.toResponse());
    } catch (error: any) {
      if (error.message === "APPLICATION_NOT_FOUND") return res.status(404).json({ error: "APPLICATION_NOT_FOUND" });
      if (error.message === "FORBIDDEN") return res.status(403).json({ error: "FORBIDDEN" });
      // D2 — CLIENT OWNER tentou REDUZIR risco: 403 com código próprio, para a
      // UI poder dizer "peça a um administrador" em vez de um "sem permissão" mudo.
      if (error.message === "RISK_CONTEXT_REDUCTION_REQUIRES_ADMIN") {
        return res.status(403).json({ error: "RISK_CONTEXT_REDUCTION_REQUIRES_ADMIN" });
      }
      console.error("ApplicationController.update", error);
      return res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }

  async delete(req: Request, res: Response): Promise<Response> {
    try {
      const actor = req.user!;
      await this.service.delete(actor, req.params.id as string);
      return res.status(204).send();
    } catch (error: any) {
      if (error.message === "APPLICATION_NOT_FOUND") return res.status(404).json({ error: "APPLICATION_NOT_FOUND" });
      if (error.message === "FORBIDDEN") return res.status(403).json({ error: "FORBIDDEN" });
      console.error("ApplicationController.delete", error);
      return res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
}
