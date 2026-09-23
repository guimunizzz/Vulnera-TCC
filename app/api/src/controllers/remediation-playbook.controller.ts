/**
 * remediation-playbook.controller.ts
 *
 * Adapta HTTP <-> RemediationPlaybookService (CP-5).
 *
 * Quem usa: routes/remediation-playbook.routes.ts.
 *
 * ==========================================================================
 * O QUE ESTE CONTROLLER DELIBERADAMENTE NÃO LÊ DO CORPO
 * ==========================================================================
 * `isSystem`, `companyId`, `source`, `sourceKey`, `sourceUrl` e `createdBy`
 * NÃO são extraídos — nem para serem ignorados depois. `extrairDto` conhece
 * apenas campos de CONTEÚDO; a origem quem decide é o service. É isto que
 * impede um tenant de publicar um "playbook oficial da OWASP" falso, visível
 * para todas as empresas.
 *
 * NÃO EXISTE endpoint de sync com a OWASP: o sync é CLI (docs/DECISIONS.md D5).
 */

import type { Request, Response } from "express";
import type { RemediationPlaybookService } from "../services/remediation-playbook.service";
import type { CreatePlaybookDTO, UpdatePlaybookDTO } from "../models/remediation-playbook.model";
import type { OwaspReference } from "../utils/owasp-parser.util";

/** Erros do service -> status HTTP (CLAUDE.md §9). */
const STATUS_POR_ERRO: Record<string, number> = {
  PLAYBOOK_NOT_FOUND: 404,
  FORBIDDEN: 403,
  CANNOT_EDIT_SYSTEM_PLAYBOOK: 403,
  USER_HAS_NO_COMPANY: 422,
  INVALID_TITLE: 400,
  INVALID_OWASP_CATEGORY: 400,
  INVALID_PLAYBOOK_CONTENT: 400,
  INVALID_CWE_IDS: 400,
  INVALID_REFERENCES: 400,
};

function traduzirErro(res: Response, error: unknown, origem: string): Response {
  const codigo = error instanceof Error ? error.message : "";
  const status = STATUS_POR_ERRO[codigo];
  if (status) return res.status(status).json({ error: codigo });
  console.error(`RemediationPlaybookController.${origem}`, error);
  return res.status(500).json({ error: "INTERNAL_ERROR" });
}

/** Os únicos campos de texto aceitos do cliente. */
const CAMPOS_TEXTO = [
  "title",
  "summary",
  "owaspCategory",
  "rootCause",
  "remediation",
  "validationSteps",
  "secureExample",
  "compensatingControls",
] as const;

/**
 * Copia só os campos de conteúdo do corpo. Campos ausentes continuam ausentes
 * (o service distingue "não mandou" de "mandou null" no update).
 */
function extrairDto(body: Record<string, unknown>): UpdatePlaybookDTO {
  const dto: Record<string, unknown> = {};
  for (const campo of CAMPOS_TEXTO) {
    if (body[campo] !== undefined) dto[campo] = body[campo];
  }
  if (body.cweIds !== undefined) dto.cweIds = body.cweIds as string[] | null;
  if (body.references !== undefined) dto.references = body.references as OwaspReference[] | null;
  return dto as UpdatePlaybookDTO;
}

export class RemediationPlaybookController {
  constructor(private readonly service: RemediationPlaybookService) {}

  /** GET /api/playbooks — System (global) + custom da empresa do ator. */
  async list(req: Request, res: Response): Promise<Response> {
    try {
      const q = req.query;
      const lista = await this.service.list(req.user!, {
        owaspCategory: typeof q.owaspCategory === "string" && q.owaspCategory ? q.owaspCategory : undefined,
        search: typeof q.search === "string" && q.search.trim() ? q.search.trim().slice(0, 200) : undefined,
        apenasSystem: q.source === "OWASP_TOP10",
        apenasCustom: q.source === "CUSTOM",
      });
      return res.status(200).json(lista);
    } catch (error) {
      return traduzirErro(res, error, "list");
    }
  }

  /** GET /api/playbooks/:id — conteúdo completo (já sanitizado na escrita). */
  async getById(req: Request, res: Response): Promise<Response> {
    try {
      const playbook = await this.service.getById(req.user!, req.params.id as string);
      return res.status(200).json(playbook);
    } catch (error) {
      return traduzirErro(res, error, "getById");
    }
  }

  /**
   * GET /api/playbooks/for-category/:owaspCategory?companyId=...
   * Usado pelo bloco "Como corrigir" do finding: custom do tenant primeiro,
   * System da OWASP depois.
   */
  async forCategory(req: Request, res: Response): Promise<Response> {
    try {
      const companyId = req.query.companyId;
      if (typeof companyId !== "string" || !companyId) {
        return res.status(400).json({ error: "MISSING_COMPANY_ID" });
      }
      const lista = await this.service.findForOwaspCategory(
        req.user!,
        req.params.owaspCategory as string,
        companyId,
      );
      return res.status(200).json(lista);
    } catch (error) {
      return traduzirErro(res, error, "forCategory");
    }
  }

  /** POST /api/playbooks — sempre CUSTOM, sempre da empresa do ator. */
  async create(req: Request, res: Response): Promise<Response> {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      if (typeof body.title !== "string") return res.status(400).json({ error: "INVALID_TITLE" });
      const criado = await this.service.create(req.user!, extrairDto(body) as CreatePlaybookDTO);
      return res.status(201).json(criado);
    } catch (error) {
      return traduzirErro(res, error, "create");
    }
  }

  /** PUT /api/playbooks/:id — só custom; System devolve 403. */
  async update(req: Request, res: Response): Promise<Response> {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const atualizado = await this.service.update(req.user!, req.params.id as string, extrairDto(body));
      return res.status(200).json(atualizado);
    } catch (error) {
      return traduzirErro(res, error, "update");
    }
  }

  /** POST /api/playbooks/:id/clone — "duplicar e adaptar" um System. */
  async clone(req: Request, res: Response): Promise<Response> {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const titulo = typeof body.title === "string" ? body.title : undefined;
      const criado = await this.service.clone(req.user!, req.params.id as string, titulo);
      return res.status(201).json(criado);
    } catch (error) {
      return traduzirErro(res, error, "clone");
    }
  }

  /** DELETE /api/playbooks/:id — só custom. */
  async delete(req: Request, res: Response): Promise<Response> {
    try {
      await this.service.delete(req.user!, req.params.id as string);
      return res.status(204).send();
    } catch (error) {
      return traduzirErro(res, error, "delete");
    }
  }
}
