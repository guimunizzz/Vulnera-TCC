import type { Request, Response } from "express";
import type { PlanService } from "../service/plan.service";
import type { CreatePlanDTO, UpdatePlanDTO } from "../model/plan.model";

export class PlanController {
  constructor(private readonly service: PlanService) {}

  async list(req: Request, res: Response): Promise<Response> {
    try {
      const plans = await this.service.list();
      return res.status(200).json(plans.map((p) => p.toResponse()));
    } catch (error) {
      console.error("PlanController.list", error);
      return res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }

  async getById(req: Request, res: Response): Promise<Response> {
    try {
      const id = req.params.id as string;
      if (!id) return res.status(400).json({ error: "MISSING_ID" });
      const plan = await this.service.getById(id);
      return res.status(200).json(plan.toResponse());
    } catch (error: any) {
      if (error.message === "PLAN_NOT_FOUND") {
        return res.status(404).json({ error: "PLAN_NOT_FOUND" });
      }
      console.error("PlanController.getById", error);
      return res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }

  async create(req: Request, res: Response): Promise<Response> {
    try {
      const body = req.body as Partial<CreatePlanDTO>;

      // 🚧 [FUTURO] migrar pra zod
      if (!body.name || typeof body.name !== "string") {
        return res.status(400).json({ error: "INVALID_NAME" });
      }
      if (
        typeof body.maxApplications !== "number" ||
        body.maxApplications < 1
      ) {
        return res.status(400).json({ error: "INVALID_MAX_APPLICATIONS" });
      }
      if (typeof body.maxProjects !== "number" || body.maxProjects < 1) {
        return res.status(400).json({ error: "INVALID_MAX_PROJECTS" });
      }
      if (typeof body.price !== "number" || body.price < 0) {
        return res.status(400).json({ error: "INVALID_PRICE" });
      }
      if (typeof body.includesRemediation !== "boolean") {
        return res.status(400).json({ error: "INVALID_INCLUDES_REMEDIATION" });
      }

      const dto: CreatePlanDTO = {
        name: body.name,
        maxApplications: body.maxApplications,
        maxProjects: body.maxProjects,
        includesRemediation: body.includesRemediation,
        price: body.price,
      };

      const plan = await this.service.create(dto);
      return res.status(201).json(plan.toResponse());
    } catch (error: any) {
      if (error.message === "INVALID_MAX_APPLICATIONS") {
        return res.status(400).json({ error: "INVALID_MAX_APPLICATIONS" });
      }
      if (error.message === "INVALID_MAX_PROJECTS") {
        return res.status(400).json({ error: "INVALID_MAX_PROJECTS" });
      }
      console.error("PlanController.create", error);
      return res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }

  async update(req: Request, res: Response): Promise<Response> {
    try {
      const id = req.params.id as string;
      const body = req.body as UpdatePlanDTO;

      if (
        body.name !== undefined &&
        (typeof body.name !== "string" || !body.name)
      ) {
        return res.status(400).json({ error: "INVALID_NAME" });
      }
      if (
        body.maxApplications !== undefined &&
        (typeof body.maxApplications !== "number" || body.maxApplications < 1)
      ) {
        return res.status(400).json({ error: "INVALID_MAX_APPLICATIONS" });
      }
      if (
        body.maxProjects !== undefined &&
        (typeof body.maxProjects !== "number" || body.maxProjects < 1)
      ) {
        return res.status(400).json({ error: "INVALID_MAX_PROJECTS" });
      }
      if (
        body.price !== undefined &&
        (typeof body.price !== "number" || body.price < 0)
      ) {
        return res.status(400).json({ error: "INVALID_PRICE" });
      }
      if (
        body.includesRemediation !== undefined &&
        typeof body.includesRemediation !== "boolean"
      ) {
        return res.status(400).json({ error: "INVALID_INCLUDES_REMEDIATION" });
      }

      const plan = await this.service.update(id, body);
      return res.status(200).json(plan.toResponse());
    } catch (error: any) {
      if (error.message === "PLAN_NOT_FOUND") {
        return res.status(404).json({ error: "PLAN_NOT_FOUND" });
      }
      console.error("PlanController.update", error);
      return res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }

  async delete(req: Request, res: Response): Promise<Response> {
    try {
      await this.service.delete(req.params.id as string);
      return res.status(204).send();
    } catch (error: any) {
      if (error.message === "PLAN_NOT_FOUND") {
        return res.status(404).json({ error: "PLAN_NOT_FOUND" });
      }
      console.error("PlanController.delete", error);
      return res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
}
