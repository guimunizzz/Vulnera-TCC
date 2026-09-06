/**
 * dast-scan.controller.ts
 *
 * Adapta HTTP <-> DastScanService. Nenhum método aqui toca o Prisma ou
 * conhece regra de negócio — só extrai/valida input, chama o service e
 * traduz erro em status HTTP (CLAUDE.md §5.4/§9).
 *
 * `getReportHtml` é o único método "não-JSON": serve o HTML original do ZAP
 * (conteúdo de terceiro, renderizado dentro do nosso domínio) com CSP
 * sandbox + nosniff — ver docs/DAST.md §5 pro porquê de cada header.
 */

import type { Request, Response } from "express";
import type { DastScanService } from "../services/dast-scan.service";

export class DastScanController {
  constructor(private readonly service: DastScanService) {}

  async create(req: Request, res: Response): Promise<Response> {
    try {
      const actor = req.user!;
      const targetUrl = typeof req.body?.targetUrl === "string" ? req.body.targetUrl : "";
      if (!targetUrl) return res.status(400).json({ error: "MISSING_TARGET_URL" });

      const scan = await this.service.create(actor, { targetUrl });
      return res.status(201).json(scan.toResponse());
    } catch (error: any) {
      if (error.message === "MISSING_TARGET_URL") return res.status(400).json({ error: "MISSING_TARGET_URL" });
      if (error.message === "INVALID_TARGET_URL") return res.status(400).json({ error: "INVALID_TARGET_URL" });
      if (error.message === "TARGET_NOT_ALLOWED") return res.status(400).json({ error: "TARGET_NOT_ALLOWED" });
      if (error.message === "SCAN_ALREADY_RUNNING_FOR_TARGET") {
        return res.status(409).json({ error: "SCAN_ALREADY_RUNNING_FOR_TARGET" });
      }
      console.error("DastScanController.create", error);
      return res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }

  async list(req: Request, res: Response): Promise<Response> {
    try {
      const actor = req.user!;
      const scans = await this.service.list(actor);
      return res.status(200).json(scans.map((s) => s.toResponse()));
    } catch (error: any) {
      console.error("DastScanController.list", error);
      return res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }

  async getById(req: Request, res: Response): Promise<Response> {
    try {
      const actor = req.user!;
      const id = req.params.id as string;
      const scan = await this.service.getById(actor, id);
      return res.status(200).json(scan.toResponse());
    } catch (error: any) {
      if (error.message === "SCAN_NOT_FOUND") return res.status(404).json({ error: "SCAN_NOT_FOUND" });
      if (error.message === "FORBIDDEN") return res.status(403).json({ error: "FORBIDDEN" });
      console.error("DastScanController.getById", error);
      return res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }

  async cancel(req: Request, res: Response): Promise<Response> {
    try {
      const actor = req.user!;
      const id = req.params.id as string;
      const scan = await this.service.cancel(actor, id);
      return res.status(200).json(scan.toResponse());
    } catch (error: any) {
      if (error.message === "SCAN_NOT_FOUND") return res.status(404).json({ error: "SCAN_NOT_FOUND" });
      if (error.message === "FORBIDDEN") return res.status(403).json({ error: "FORBIDDEN" });
      if (error.message === "INVALID_STATUS_TRANSITION") return res.status(422).json({ error: "INVALID_STATUS_TRANSITION" });
      console.error("DastScanController.cancel", error);
      return res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }

  async listFindings(req: Request, res: Response): Promise<Response> {
    try {
      const actor = req.user!;
      const id = req.params.id as string;
      const findings = await this.service.listFindings(actor, id);
      return res.status(200).json(findings.map((f) => f.toResponse()));
    } catch (error: any) {
      if (error.message === "SCAN_NOT_FOUND") return res.status(404).json({ error: "SCAN_NOT_FOUND" });
      if (error.message === "FORBIDDEN") return res.status(403).json({ error: "FORBIDDEN" });
      console.error("DastScanController.listFindings", error);
      return res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }

  async getReportHtml(req: Request, res: Response): Promise<Response | void> {
    try {
      const actor = req.user!;
      const id = req.params.id as string;
      const buffer = await this.service.getReportFile(actor, id, "report.html");

      // HTML de terceiro (ZAP) renderizado dentro do nosso domínio: sandbox
      // sem allow-scripts/allow-same-origin barra qualquer script embutido de
      // rodar com nosso cookie/origem; nosniff impede reinterpretação de tipo.
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Content-Security-Policy", "sandbox");
      res.setHeader("X-Content-Type-Options", "nosniff");
      return res.status(200).send(buffer);
    } catch (error: any) {
      if (error.message === "SCAN_NOT_FOUND") return res.status(404).json({ error: "SCAN_NOT_FOUND" });
      if (error.message === "FORBIDDEN") return res.status(403).json({ error: "FORBIDDEN" });
      if (error.message === "REPORT_NOT_FOUND") return res.status(404).json({ error: "REPORT_NOT_FOUND" });
      console.error("DastScanController.getReportHtml", error);
      return res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }

  async getReportData(req: Request, res: Response): Promise<Response> {
    try {
      const actor = req.user!;
      const id = req.params.id as string;
      const data = await this.service.getReportData(actor, id);
      return res.status(200).json(data);
    } catch (error: any) {
      if (error.message === "SCAN_NOT_FOUND") return res.status(404).json({ error: "SCAN_NOT_FOUND" });
      if (error.message === "FORBIDDEN") return res.status(403).json({ error: "FORBIDDEN" });
      console.error("DastScanController.getReportData", error);
      return res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
}
