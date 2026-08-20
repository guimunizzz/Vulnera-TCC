import type { Request, Response } from "express";
import type { ReportService } from "../services/report.service";
import type { ReportType } from "../models/report.model";

const REPORT_TYPES: ReportType[] = ["EXECUTIVE", "TECHNICAL"];

export class ReportController {
  constructor(private readonly service: ReportService) {}

  /** GET /api/projects/:id/report-data — montado em project.routes.ts (URL exigida pelo enunciado). */
  async getReportData(req: Request, res: Response): Promise<Response> {
    try {
      const projectId = req.params.id as string;
      const actor = req.user!;
      const data = await this.service.getReportData(actor, projectId);
      return res.status(200).json(data);
    } catch (error: any) {
      if (error.message === "PROJECT_NOT_FOUND") return res.status(404).json({ error: "PROJECT_NOT_FOUND" });
      if (error.message === "APPLICATION_NOT_FOUND") return res.status(404).json({ error: "APPLICATION_NOT_FOUND" });
      if (error.message === "COMPANY_NOT_FOUND") return res.status(404).json({ error: "COMPANY_NOT_FOUND" });
      if (error.message === "FORBIDDEN") return res.status(403).json({ error: "FORBIDDEN" });
      if (error.message === "PROJECT_NOT_READY_FOR_REPORT") {
        return res.status(422).json({ error: "PROJECT_NOT_READY_FOR_REPORT" });
      }
      console.error("ReportController.getReportData", error);
      return res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }

  async create(req: Request, res: Response): Promise<Response> {
    try {
      const body = req.body as Partial<{ projectId: string; type: ReportType }>;

      // 🚧 [FUTURO] migrar pra zod
      if (!body.projectId || typeof body.projectId !== "string") {
        return res.status(400).json({ error: "INVALID_PROJECT_ID" });
      }
      if (!body.type || !REPORT_TYPES.includes(body.type)) {
        return res.status(400).json({ error: "INVALID_TYPE" });
      }

      const actor = req.user!;
      const report = await this.service.generate(actor, body.projectId, body.type);
      return res.status(201).json(report.toResponse());
    } catch (error: any) {
      if (error.message === "PROJECT_NOT_FOUND") return res.status(404).json({ error: "PROJECT_NOT_FOUND" });
      if (error.message === "FORBIDDEN") return res.status(403).json({ error: "FORBIDDEN" });
      if (error.message === "PROJECT_NOT_READY_FOR_REPORT") {
        return res.status(422).json({ error: "PROJECT_NOT_READY_FOR_REPORT" });
      }
      console.error("ReportController.create", error);
      return res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }

  async list(req: Request, res: Response): Promise<Response> {
    try {
      const projectId = req.query.projectId as string | undefined;
      if (!projectId) return res.status(400).json({ error: "MISSING_PROJECT_ID" });

      const actor = req.user!;
      const reports = await this.service.listByProject(actor, projectId);
      return res.status(200).json(reports.map((r) => r.toResponse()));
    } catch (error: any) {
      if (error.message === "PROJECT_NOT_FOUND") return res.status(404).json({ error: "PROJECT_NOT_FOUND" });
      if (error.message === "FORBIDDEN") return res.status(403).json({ error: "FORBIDDEN" });
      console.error("ReportController.list", error);
      return res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
}
