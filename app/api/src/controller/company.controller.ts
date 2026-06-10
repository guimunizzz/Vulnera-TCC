import type { Request, Response } from "express";
import type { CompanyService } from "../service/company.service";
import type { CreateCompanyDTO, UpdateCompanyDTO } from "../model/company.model";

export class CompanyController {
  constructor(private readonly service: CompanyService) {}

  async list(req: Request, res: Response): Promise<Response> {
    try {
      const companies = await this.service.list();
      return res.status(200).json(companies.map((c) => c.toResponse()));
    } catch (error) {
      console.error("CompanyController.list", error);
      return res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }

  async getById(req: Request, res: Response): Promise<Response> {
    try {
      const id = req.params.id as string;
      if (!id) return res.status(400).json({ error: "MISSING_ID" });
      const company = await this.service.getById(id);
      return res.status(200).json(company.toResponse());
    } catch (error: any) {
      if (error.message === "COMPANY_NOT_FOUND") {
        return res.status(404).json({ error: "COMPANY_NOT_FOUND" });
      }
      console.error("CompanyController.getById", error);
      return res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }

  async create(req: Request, res: Response): Promise<Response> {
    try {
      const body = req.body as Partial<CreateCompanyDTO>;

      // 🚧 [FUTURO] migrar pra zod
      if (!body.name || typeof body.name !== "string") {
        return res.status(400).json({ error: "INVALID_NAME" });
      }
      if (body.cnpj !== undefined && typeof body.cnpj !== "string") {
        return res.status(400).json({ error: "INVALID_CNPJ" });
      }
      if (!body.planId || typeof body.planId !== "string") {
        return res.status(400).json({ error: "INVALID_PLAN_ID" });
      }

      const dto: CreateCompanyDTO = {
        name: body.name,
        cnpj: body.cnpj,
        planId: body.planId,
      };

      const company = await this.service.create(dto);
      return res.status(201).json(company.toResponse());
    } catch (error: any) {
      if (error.message === "PLAN_NOT_FOUND") {
        return res.status(404).json({ error: "PLAN_NOT_FOUND" });
      }
      console.error("CompanyController.create", error);
      return res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }

  async update(req: Request, res: Response): Promise<Response> {
    try {
      const id = req.params.id as string;
      const body = req.body as UpdateCompanyDTO;

      if (
        body.name !== undefined &&
        (typeof body.name !== "string" || !body.name)
      ) {
        return res.status(400).json({ error: "INVALID_NAME" });
      }
      if (body.cnpj !== undefined && typeof body.cnpj !== "string") {
        return res.status(400).json({ error: "INVALID_CNPJ" });
      }
      if (
        body.planId !== undefined &&
        (typeof body.planId !== "string" || !body.planId)
      ) {
        return res.status(400).json({ error: "INVALID_PLAN_ID" });
      }

      const company = await this.service.update(id, body);
      return res.status(200).json(company.toResponse());
    } catch (error: any) {
      if (error.message === "COMPANY_NOT_FOUND") {
        return res.status(404).json({ error: "COMPANY_NOT_FOUND" });
      }
      if (error.message === "PLAN_NOT_FOUND") {
        return res.status(404).json({ error: "PLAN_NOT_FOUND" });
      }
      console.error("CompanyController.update", error);
      return res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }

  async delete(req: Request, res: Response): Promise<Response> {
    try {
      await this.service.delete(req.params.id as string);
      return res.status(204).send();
    } catch (error: any) {
      if (error.message === "COMPANY_NOT_FOUND") {
        return res.status(404).json({ error: "COMPANY_NOT_FOUND" });
      }
      console.error("CompanyController.delete", error);
      return res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
}
