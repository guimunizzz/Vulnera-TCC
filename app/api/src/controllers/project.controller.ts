import type { Request, Response } from "express";
import type { ProjectService } from "../services/project.service";
import type { CreateProjectDTO, ProjectStatus, UpdateProjectDTO } from "../models/project.model";

const ANALYSIS_TYPES = ["SAST", "DAST", "MATURITY", "COMBO"];
const ANALYSIS_LEVELS = ["BASIC", "INTERMEDIATE", "ADVANCED"];
const STATUSES: ProjectStatus[] = ["PENDING", "IN_PROGRESS", "IN_REVIEW", "COMPLETED"];

export class ProjectController {
  constructor(private readonly service: ProjectService) {}

  async list(req: Request, res: Response): Promise<Response> {
    try {
      const actor = req.user!;
      const projects = await this.service.list(actor);
      return res.status(200).json(projects.map((p) => p.toResponse()));
    } catch (error) {
      console.error("ProjectController.list", error);
      return res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }

  async getById(req: Request, res: Response): Promise<Response> {
    try {
      const id = req.params.id as string;
      if (!id) return res.status(400).json({ error: "MISSING_ID" });
      const actor = req.user!;
      const project = await this.service.getById(actor, id);
      return res.status(200).json(project.toResponse());
    } catch (error: any) {
      if (error.message === "PROJECT_NOT_FOUND") return res.status(404).json({ error: "PROJECT_NOT_FOUND" });
      if (error.message === "FORBIDDEN") return res.status(403).json({ error: "FORBIDDEN" });
      console.error("ProjectController.getById", error);
      return res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }

  async create(req: Request, res: Response): Promise<Response> {
    try {
      const body = req.body as Partial<CreateProjectDTO>;

      // 🚧 [FUTURO] migrar pra zod
      if (!body.applicationId || typeof body.applicationId !== "string") {
        return res.status(400).json({ error: "INVALID_APPLICATION_ID" });
      }
      if (!body.name || typeof body.name !== "string") {
        return res.status(400).json({ error: "INVALID_NAME" });
      }
      if (body.analysisType !== undefined && !ANALYSIS_TYPES.includes(body.analysisType)) {
        return res.status(400).json({ error: "INVALID_ANALYSIS_TYPE" });
      }
      if (body.analysisLevel !== undefined && !ANALYSIS_LEVELS.includes(body.analysisLevel)) {
        return res.status(400).json({ error: "INVALID_ANALYSIS_LEVEL" });
      }
      if (body.hasRemediation !== undefined && typeof body.hasRemediation !== "boolean") {
        return res.status(400).json({ error: "INVALID_HAS_REMEDIATION" });
      }

      const dto: CreateProjectDTO = {
        applicationId: body.applicationId,
        name: body.name,
        description: body.description,
        analysisType: body.analysisType,
        analysisLevel: body.analysisLevel,
        hasRemediation: body.hasRemediation,
        scopeIn: body.scopeIn,
        scopeOut: body.scopeOut,
        notes: body.notes,
      };

      const actor = req.user!;
      const project = await this.service.create(actor, dto);
      return res.status(201).json(project.toResponse());
    } catch (error: any) {
      if (error.message === "APPLICATION_NOT_FOUND") return res.status(404).json({ error: "APPLICATION_NOT_FOUND" });
      if (error.message === "FORBIDDEN") return res.status(403).json({ error: "FORBIDDEN" });
      if (error.message === "APPLICATION_ALREADY_HAS_PROJECT") {
        return res.status(409).json({ error: "APPLICATION_ALREADY_HAS_PROJECT" });
      }
      console.error("ProjectController.create", error);
      return res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }

  async update(req: Request, res: Response): Promise<Response> {
    try {
      const id = req.params.id as string;
      const body = req.body as UpdateProjectDTO;

      if (body.name !== undefined && (typeof body.name !== "string" || !body.name)) {
        return res.status(400).json({ error: "INVALID_NAME" });
      }
      if (body.analysisType !== undefined && !ANALYSIS_TYPES.includes(body.analysisType)) {
        return res.status(400).json({ error: "INVALID_ANALYSIS_TYPE" });
      }
      if (body.analysisLevel !== undefined && !ANALYSIS_LEVELS.includes(body.analysisLevel)) {
        return res.status(400).json({ error: "INVALID_ANALYSIS_LEVEL" });
      }
      if (body.hasRemediation !== undefined && typeof body.hasRemediation !== "boolean") {
        return res.status(400).json({ error: "INVALID_HAS_REMEDIATION" });
      }

      const actor = req.user!;
      const project = await this.service.update(actor, id, body);
      return res.status(200).json(project.toResponse());
    } catch (error: any) {
      if (error.message === "PROJECT_NOT_FOUND") return res.status(404).json({ error: "PROJECT_NOT_FOUND" });
      if (error.message === "FORBIDDEN") return res.status(403).json({ error: "FORBIDDEN" });
      console.error("ProjectController.update", error);
      return res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }

  async transition(req: Request, res: Response): Promise<Response> {
    try {
      const id = req.params.id as string;
      const body = req.body as Partial<{ toStatus: string }>;

      if (!body.toStatus || !STATUSES.includes(body.toStatus as ProjectStatus)) {
        return res.status(400).json({ error: "INVALID_STATUS_TRANSITION" });
      }

      const actor = req.user!;
      const project = await this.service.transition(actor, id, body.toStatus as ProjectStatus);
      return res.status(200).json(project.toResponse());
    } catch (error: any) {
      if (error.message === "PROJECT_NOT_FOUND") return res.status(404).json({ error: "PROJECT_NOT_FOUND" });
      if (error.message === "FORBIDDEN") return res.status(403).json({ error: "FORBIDDEN" });
      if (error.message === "INVALID_STATUS_TRANSITION") {
        return res.status(400).json({ error: "INVALID_STATUS_TRANSITION" });
      }
      console.error("ProjectController.transition", error);
      return res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
}
