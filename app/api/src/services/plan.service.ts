import { PlanRepository } from "../repositories/plan.repository";
import { PlanEntity, CreatePlanDTO, UpdatePlanDTO } from "../models/plan.model";

export class PlanService {
  constructor(private readonly repository: PlanRepository) {}

  async getById(id: string): Promise<PlanEntity> {
    const plan = await this.repository.findById(id);
    if (!plan) throw new Error("PLAN_NOT_FOUND");
    return new PlanEntity(plan);
  }

  async list(): Promise<PlanEntity[]> {
    const plans = await this.repository.findAll();
    return plans.map((p) => new PlanEntity(p));
  }

  async create(dto: CreatePlanDTO): Promise<PlanEntity> {
    if (dto.maxApplications < 1) throw new Error("INVALID_MAX_APPLICATIONS");
    if (dto.maxProjects < 1) throw new Error("INVALID_MAX_PROJECTS");
    const created = await this.repository.create(dto);
    return new PlanEntity(created);
  }

  async update(id: string, dto: UpdatePlanDTO): Promise<PlanEntity> {
    await this.getById(id);
    const updated = await this.repository.update(id, dto);
    return new PlanEntity(updated);
  }

  async delete(id: string): Promise<void> {
    await this.getById(id);
    await this.repository.delete(id);
  }
}
