/**
 * saved-query.controller.ts
 *
 * Adapta HTTP ↔ SavedQueryService (CP-6).
 *
 * ⚠️ `ownerId`, `companyId` e `isOwner` NÃO são lidos do corpo. O dono é quem
 * está autenticado e a empresa vem do banco — aceitá-los do cliente deixaria
 * qualquer um publicar uma watchlist dentro de outra empresa.
 *
 * `descartados` viaja na resposta de criação/edição de propósito: quando um
 * filtro é removido na canonização (um projeto que não existe mais, um
 * parâmetro desconhecido), a pessoa precisa saber na hora — descobrir depois,
 * ao clicar no atalho e ver resultados demais, é tarde.
 */

import type { Request, Response } from "express";
import type { SavedQueryService } from "../services/saved-query.service";
import type { CreateSavedQueryDTO, SavedQueryScope } from "../models/saved-query.model";

const STATUS_POR_ERRO: Record<string, number> = {
  SAVED_QUERY_NOT_FOUND: 404,
  FORBIDDEN: 403,
  PENTESTER_CANNOT_SHARE_QUERY: 403,
  SAVED_QUERY_NAME_TAKEN: 409,
  SAVED_QUERY_ALREADY_EXISTS: 409,
  SAVED_QUERY_LIMIT_REACHED: 422,
  PINNED_LIMIT_REACHED: 422,
  USER_HAS_NO_COMPANY: 422,
  INVALID_NAME: 400,
  INVALID_DESCRIPTION: 400,
  INVALID_SCOPE: 400,
  INVALID_QUERY: 400,
  EMPTY_QUERY: 400,
  QUERY_TOO_LONG: 400,
};

function traduzirErro(res: Response, error: unknown, origem: string): Response {
  const codigo = error instanceof Error ? error.message : "";
  const status = STATUS_POR_ERRO[codigo];
  if (status) return res.status(status).json({ error: codigo });
  console.error(`SavedQueryController.${origem}`, error);
  return res.status(500).json({ error: "INTERNAL_ERROR" });
}

export class SavedQueryController {
  constructor(private readonly service: SavedQueryService) {}

  /** GET /api/saved-queries?pinned=true */
  async list(req: Request, res: Response): Promise<Response> {
    try {
      const lista = await this.service.list(req.user!, { apenasFixadas: req.query.pinned === "true" });
      return res.status(200).json(lista);
    } catch (error) {
      return traduzirErro(res, error, "list");
    }
  }

  /** GET /api/saved-queries/:id */
  async getById(req: Request, res: Response): Promise<Response> {
    try {
      return res.status(200).json(await this.service.getById(req.user!, req.params.id as string));
    } catch (error) {
      return traduzirErro(res, error, "getById");
    }
  }

  /** POST /api/saved-queries */
  async create(req: Request, res: Response): Promise<Response> {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      if (typeof body.name !== "string") return res.status(400).json({ error: "INVALID_NAME" });
      if (typeof body.queryString !== "string") return res.status(400).json({ error: "INVALID_QUERY" });

      const dto: CreateSavedQueryDTO = {
        name: body.name,
        queryString: body.queryString,
        description: (body.description as string | null | undefined) ?? null,
        scope: body.scope as SavedQueryScope | undefined,
        pinned: body.pinned === true,
      };
      const { saved, descartados } = await this.service.create(req.user!, dto);
      return res.status(201).json({ ...saved, descartados });
    } catch (error) {
      return traduzirErro(res, error, "create");
    }
  }

  /** PUT /api/saved-queries/:id */
  async update(req: Request, res: Response): Promise<Response> {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const dto: Record<string, unknown> = {};
      for (const campo of ["name", "description", "queryString", "scope", "pinned"] as const) {
        if (body[campo] !== undefined) dto[campo] = body[campo];
      }
      const { saved, descartados } = await this.service.update(req.user!, req.params.id as string, dto);
      return res.status(200).json({ ...saved, descartados });
    } catch (error) {
      return traduzirErro(res, error, "update");
    }
  }

  /** DELETE /api/saved-queries/:id */
  async delete(req: Request, res: Response): Promise<Response> {
    try {
      await this.service.delete(req.user!, req.params.id as string);
      return res.status(204).send();
    } catch (error) {
      return traduzirErro(res, error, "delete");
    }
  }
}
