import type { Request, Response } from "express";
import type { CompanyService } from "../services/company.service";
import type { CreateCompanyDTO, UpdateCompanyDTO } from "../models/company.model";

// 14 dígitos crus OU máscara NN.NNN.NNN/NNNN-NN — sem dígito verificador
// (fora de escopo desta fase, ver CLAUDE.md §15).
const CNPJ_REGEX = /^(\d{14}|\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})$/;

export class CompanyController {
  constructor(private readonly service: CompanyService) {}

  async me(req: Request, res: Response): Promise<Response> {
    try {
      const actor = req.user!;
      const company = await this.service.getMine(actor);
      return res.status(200).json(company.toResponse());
    } catch (error: any) {
      if (error.message === "USER_HAS_NO_COMPANY") {
        return res.status(404).json({ error: "USER_HAS_NO_COMPANY" });
      }
      console.error("CompanyController.me", error);
      return res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }

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
      if (body.cnpj !== undefined && !CNPJ_REGEX.test(body.cnpj)) {
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

      const actor = req.user!;
      const company = await this.service.create(actor, dto);
      return res.status(201).json(company.toResponse());
    } catch (error: any) {
      if (error.message === "PLAN_NOT_FOUND") {
        return res.status(404).json({ error: "PLAN_NOT_FOUND" });
      }
      if (error.message === "USER_ALREADY_HAS_COMPANY") {
        return res.status(409).json({ error: "USER_ALREADY_HAS_COMPANY" });
      }
      if (error.message === "COMPANY_ALREADY_EXISTS") {
        return res.status(409).json({ error: "COMPANY_ALREADY_EXISTS" });
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
      if (body.cnpj !== undefined && !CNPJ_REGEX.test(body.cnpj)) {
        return res.status(400).json({ error: "INVALID_CNPJ" });
      }
      if (
        body.planId !== undefined &&
        (typeof body.planId !== "string" || !body.planId)
      ) {
        return res.status(400).json({ error: "INVALID_PLAN_ID" });
      }

      const actor = req.user!;
      const company = await this.service.update(actor, id, body);
      return res.status(200).json(company.toResponse());
    } catch (error: any) {
      if (error.message === "COMPANY_NOT_FOUND") {
        return res.status(404).json({ error: "COMPANY_NOT_FOUND" });
      }
      if (error.message === "PLAN_NOT_FOUND") {
        return res.status(404).json({ error: "PLAN_NOT_FOUND" });
      }
      if (error.message === "COMPANY_ALREADY_EXISTS") {
        return res.status(409).json({ error: "COMPANY_ALREADY_EXISTS" });
      }
      if (error.message === "FORBIDDEN") {
        return res.status(403).json({ error: "FORBIDDEN" });
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
