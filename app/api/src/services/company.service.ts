import { CompanyRepository } from "../repositories/company.repository";
import { PlanRepository } from "../repositories/plan.repository";
import {
  CompanyEntity,
  CreateCompanyDTO,
  UpdateCompanyDTO,
} from "../models/company.model";

export class CompanyService {
  constructor(
    private readonly repository: CompanyRepository,
    private readonly planRepository: PlanRepository,
  ) {}

  async getById(id: string): Promise<CompanyEntity> {
    const company = await this.repository.findById(id);
    if (!company) throw new Error("COMPANY_NOT_FOUND");
    return new CompanyEntity(company);
  }

  async list(): Promise<CompanyEntity[]> {
    const companies = await this.repository.findAll();
    return companies.map((c) => new CompanyEntity(c));
  }

  async create(dto: CreateCompanyDTO): Promise<CompanyEntity> {
    const plan = await this.planRepository.findById(dto.planId);
    if (!plan) throw new Error("PLAN_NOT_FOUND");
    const created = await this.repository.create(dto);
    return new CompanyEntity(created);
  }

  async update(id: string, dto: UpdateCompanyDTO): Promise<CompanyEntity> {
    await this.getById(id);

    if (dto.planId !== undefined) {
      const plan = await this.planRepository.findById(dto.planId);
      if (!plan) throw new Error("PLAN_NOT_FOUND");
    }

    const updated = await this.repository.update(id, dto);
    return new CompanyEntity(updated);
  }

  async delete(id: string): Promise<void> {
    await this.getById(id);
    await this.repository.delete(id);
  }
}
