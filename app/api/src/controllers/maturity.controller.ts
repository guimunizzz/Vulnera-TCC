import type { Request, Response } from "express";
import type { MaturityService } from "../services/maturity.service";
import type { ScoreInputDTO } from "../models/maturity.model";

export class MaturityController {
  constructor(private readonly service: MaturityService) {}

  async getCatalog(req: Request, res: Response): Promise<Response> {
    try {
      const catalog = await this.service.getCatalog();
      return res.status(200).json(catalog);
    } catch (error) {
      console.error("MaturityController.getCatalog", error);
      return res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }

  async createAssessment(req: Request, res: Response): Promise<Response> {
    try {
      const body = req.body as Partial<{ companyId: string }>;

      // 🚧 [FUTURO] migrar pra zod
      if (!body.companyId || typeof body.companyId !== "string") {
        return res.status(400).json({ error: "INVALID_COMPANY_ID" });
      }

      const actor = req.user!;
      const assessment = await this.service.createAssessment(actor, body.companyId);
      return res.status(201).json(assessment.toResponse());
    } catch (error: any) {
      if (error.message === "FORBIDDEN") return res.status(403).json({ error: "FORBIDDEN" });
      if (error.message === "COMPANY_NOT_FOUND") return res.status(404).json({ error: "COMPANY_NOT_FOUND" });
      console.error("MaturityController.createAssessment", error);
      return res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }

  async submitScores(req: Request, res: Response): Promise<Response> {
    try {
      const id = req.params.id as string;
      const body = req.body as Partial<{ scores: ScoreInputDTO[] }>;

      if (!Array.isArray(body.scores) || body.scores.length === 0) {
        return res.status(400).json({ error: "INVALID_SCORES" });
      }
      for (const item of body.scores) {
        if (!item || typeof item.controlId !== "string" || !item.controlId) {
          return res.status(400).json({ error: "INVALID_SCORES" });
        }
        if (typeof item.score !== "number") {
          return res.status(400).json({ error: "INVALID_SCORES" });
        }
      }

      const actor = req.user!;
      const assessment = await this.service.submitScores(actor, id, body.scores);
      return res.status(200).json(assessment.toResponse());
    } catch (error: any) {
      if (error.message === "FORBIDDEN") return res.status(403).json({ error: "FORBIDDEN" });
      if (error.message === "ASSESSMENT_NOT_FOUND") return res.status(404).json({ error: "ASSESSMENT_NOT_FOUND" });
      if (error.message === "CONTROL_NOT_FOUND") return res.status(404).json({ error: "CONTROL_NOT_FOUND" });
      if (error.message === "INVALID_SCORE_VALUE") return res.status(400).json({ error: "INVALID_SCORE_VALUE" });
      console.error("MaturityController.submitScores", error);
      return res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }

  async getLatestByCompany(req: Request, res: Response): Promise<Response> {
    try {
      const companyId = req.params.companyId as string;
      const actor = req.user!;
      const assessment = await this.service.getLatestByCompany(actor, companyId);
      return res.status(200).json(assessment.toResponse());
    } catch (error: any) {
      if (error.message === "FORBIDDEN") return res.status(403).json({ error: "FORBIDDEN" });
      if (error.message === "ASSESSMENT_NOT_FOUND") return res.status(404).json({ error: "ASSESSMENT_NOT_FOUND" });
      console.error("MaturityController.getLatestByCompany", error);
      return res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
}
