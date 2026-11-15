/**
 * code-scan.controller.ts
 *
 * HTTP das importações SAST/SCA (ADR-052): extrai entrada, chama o service e
 * traduz os códigos de erro da aplicação para status HTTP. Sem regra de negócio.
 */

import type { Request, Response } from "express";
import type { CodeScanService } from "../services/code-scan.service";

/** Erros de negócio conhecidos → status. O que não estiver aqui é 500. */
const STATUS_BY_ERROR: Record<string, number> = {
  MISSING_PROJECT_ID: 400,
  MISSING_FILE: 400,
  MISSING_TRIAGE_STATUS: 400,
  INVALID_TRIAGE_STATUS: 400,
  INVALID_TRIAGE_NOTE: 400,
  MISSING_TITLE: 400,
  MISSING_DESCRIPTION: 400,
  MISSING_OWASP_CATEGORY: 400,
  INVALID_OWASP_CATEGORY: 400,
  MISSING_CVSS_VECTOR: 400,
  INVALID_CVSS_VECTOR: 400,
  INVALID_FILE_FORMAT: 400,
  // 422: o arquivo é JSON válido, mas não é algo que o Vulnera saiba ler.
  UNSUPPORTED_REPORT_FORMAT: 422,
  UNSUPPORTED_SARIF_VERSION: 422,
  IMPORT_TOO_LARGE: 422,
  FORBIDDEN: 403,
  PROJECT_NOT_FOUND: 404,
  IMPORT_NOT_FOUND: 404,
  FINDING_NOT_FOUND: 404,
  FINDING_ALREADY_PROMOTED: 409,
};

export class CodeScanController {
  constructor(private readonly service: CodeScanService) {}

  private fail(res: Response, where: string, error: unknown): Response {
    const message = error instanceof Error ? error.message : "";
    const status = STATUS_BY_ERROR[message];
    if (status) return res.status(status).json({ error: message });
    console.error(`CodeScanController.${where}`, error);
    return res.status(500).json({ error: "INTERNAL_ERROR" });
  }

  async importReport(req: Request, res: Response): Promise<Response> {
    try {
      const projectId = typeof req.body?.projectId === "string" ? req.body.projectId : undefined;
      const file = req.file ? { originalName: req.file.originalname, buffer: req.file.buffer } : undefined;
      const created = await this.service.importReport(req.user!, projectId, file);
      return res.status(201).json(created);
    } catch (error) {
      return this.fail(res, "importReport", error);
    }
  }

  async listImports(req: Request, res: Response): Promise<Response> {
    try {
      const projectId = typeof req.query.projectId === "string" ? req.query.projectId : undefined;
      return res.status(200).json(await this.service.listImports(req.user!, projectId));
    } catch (error) {
      return this.fail(res, "listImports", error);
    }
  }

  async getImport(req: Request, res: Response): Promise<Response> {
    try {
      return res.status(200).json(await this.service.getImport(req.user!, req.params.id as string));
    } catch (error) {
      return this.fail(res, "getImport", error);
    }
  }

  async listFindings(req: Request, res: Response): Promise<Response> {
    try {
      return res.status(200).json(await this.service.listFindings(req.user!, req.params.id as string));
    } catch (error) {
      return this.fail(res, "listFindings", error);
    }
  }

  async compare(req: Request, res: Response): Promise<Response> {
    try {
      return res.status(200).json(await this.service.compare(req.user!, req.params.id as string));
    } catch (error) {
      return this.fail(res, "compare", error);
    }
  }

  async getReportData(req: Request, res: Response): Promise<Response> {
    try {
      return res.status(200).json(await this.service.getReportData(req.user!, req.params.id as string));
    } catch (error) {
      return this.fail(res, "getReportData", error);
    }
  }

  async triage(req: Request, res: Response): Promise<Response> {
    try {
      const updated = await this.service.triage(req.user!, req.params.findingId as string, {
        triageStatus: req.body?.triageStatus,
        note: req.body?.note,
      });
      return res.status(200).json(updated);
    } catch (error) {
      return this.fail(res, "triage", error);
    }
  }

  async getPromotionDraft(req: Request, res: Response): Promise<Response> {
    try {
      return res.status(200).json(await this.service.getPromotionDraft(req.user!, req.params.findingId as string));
    } catch (error) {
      return this.fail(res, "getPromotionDraft", error);
    }
  }

  async promote(req: Request, res: Response): Promise<Response> {
    try {
      const created = await this.service.promote(req.user!, req.params.findingId as string, {
        title: req.body?.title,
        description: req.body?.description,
        owaspCategory: req.body?.owaspCategory,
        cvssVector: req.body?.cvssVector,
        impact: req.body?.impact,
        recommendation: req.body?.recommendation,
      });
      return res.status(201).json(created);
    } catch (error) {
      return this.fail(res, "promote", error);
    }
  }
}
