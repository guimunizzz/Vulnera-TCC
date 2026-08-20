import type { Request, Response } from "express";
import type { ApplicationService } from "../services/application.service";
import type { CreateApplicationDTO, UpdateApplicationDTO } from "../models/application.model";

const URL_REGEX = /^https?:\/\/[^\s]+$/;
const ENVIRONMENTS = ["PROD", "HOMOL", "DEV"];

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
      const body = req.body as Partial<CreateApplicationDTO>;

      // 🚧 [FUTURO] migrar pra zod
      if (!body.name || typeof body.name !== "string") {
        return res.status(400).json({ error: "INVALID_NAME" });
      }
      if (body.url !== undefined && !URL_REGEX.test(body.url)) {
        return res.status(400).json({ error: "INVALID_URL" });
      }
      if (body.environment !== undefined && !ENVIRONMENTS.includes(body.environment)) {
        return res.status(400).json({ error: "INVALID_ENVIRONMENT" });
      }

      const dto: CreateApplicationDTO = {
        name: body.name,
        url: body.url,
        environment: body.environment,
        techStack: body.techStack,
        description: body.description,
      };

      const actor = req.user!;
      const application = await this.service.create(actor, dto);
      return res.status(201).json(application.toResponse());
    } catch (error: any) {
      if (error.message === "USER_HAS_NO_COMPANY") return res.status(404).json({ error: "USER_HAS_NO_COMPANY" });
      if (error.message === "NO_ACTIVE_SUBSCRIPTION") return res.status(422).json({ error: "NO_ACTIVE_SUBSCRIPTION" });
      if (error.message === "PLAN_NOT_FOUND") return res.status(404).json({ error: "PLAN_NOT_FOUND" });
      if (error.message === "PLAN_LIMIT_REACHED") return res.status(422).json({ error: "PLAN_LIMIT_REACHED" });
      console.error("ApplicationController.create", error);
      return res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }

  async update(req: Request, res: Response): Promise<Response> {
    try {
      const id = req.params.id as string;
      const body = req.body as UpdateApplicationDTO;

      if (body.name !== undefined && (typeof body.name !== "string" || !body.name)) {
        return res.status(400).json({ error: "INVALID_NAME" });
      }
      if (body.url !== undefined && !URL_REGEX.test(body.url)) {
        return res.status(400).json({ error: "INVALID_URL" });
      }
      if (body.environment !== undefined && !ENVIRONMENTS.includes(body.environment)) {
        return res.status(400).json({ error: "INVALID_ENVIRONMENT" });
      }

      const actor = req.user!;
      const application = await this.service.update(actor, id, body);
      return res.status(200).json(application.toResponse());
    } catch (error: any) {
      if (error.message === "APPLICATION_NOT_FOUND") return res.status(404).json({ error: "APPLICATION_NOT_FOUND" });
      if (error.message === "FORBIDDEN") return res.status(403).json({ error: "FORBIDDEN" });
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
