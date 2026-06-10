import type { PrismaClient } from "@prisma/client";
import type { Plan, CreatePlanDTO, UpdatePlanDTO } from "../model/plan.model";

export class PlanRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Plan | null> {
    return this.prisma.plan.findUnique({ where: { id } });
  }

  async findAll(): Promise<Plan[]> {
    return this.prisma.plan.findMany({ orderBy: { createdAt: "desc" } });
  }

  async create(data: CreatePlanDTO): Promise<Plan> {
    return this.prisma.plan.create({ data });
  }

  async update(id: string, data: UpdatePlanDTO): Promise<Plan> {
    return this.prisma.plan.update({ where: { id }, data });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.plan.delete({ where: { id } });
  }
}
