import type { Prisma, PrismaClient } from "@prisma/client";
import type { Plan, CreatePlanDTO, UpdatePlanDTO } from "../models/plan.model";

export async function lockEligiblePlan(tx: Prisma.TransactionClient, planId: string): Promise<void> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM Plan WHERE id = ${planId} AND isActive = true FOR UPDATE
  `;
  if (rows.length === 0) throw new Error("PLAN_NOT_FOUND");
}

export class PlanRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Plan | null> {
    return this.prisma.plan.findUnique({ where: { id } });
  }

  async findAll(): Promise<Plan[]> {
    return this.prisma.plan.findMany({ orderBy: { createdAt: "desc" } });
  }

  async findByName(name: string): Promise<Plan | null> {
    return this.prisma.plan.findUnique({ where: { name } });
  }

  async create(data: CreatePlanDTO): Promise<Plan> {
    return this.prisma.plan.create({ data });
  }

  async update(id: string, data: UpdatePlanDTO): Promise<Plan> {
    return this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM Plan WHERE id = ${id} FOR UPDATE
      `;
      if (locked.length === 0) throw new Error("PLAN_NOT_FOUND");
      const current = await tx.plan.findUniqueOrThrow({ where: { id } });
      const materialTermsChanged = (data.name !== undefined && data.name !== current.name)
        || (data.price !== undefined && !current.price.equals(data.price))
        || (data.maxApplications !== undefined && data.maxApplications !== current.maxApplications)
        || (data.maxProjects !== undefined && data.maxProjects !== current.maxProjects)
        || (data.includesRemediation !== undefined && data.includesRemediation !== current.includesRemediation);
      if (materialTermsChanged && await tx.subscription.findFirst({ where: { planId: id, status: "ACTIVE" } })) {
        throw new Error("PLAN_HAS_ACTIVE_SUBSCRIPTIONS");
      }
      return tx.plan.update({ where: { id }, data });
    }, { isolationLevel: "ReadCommitted" });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.plan.delete({ where: { id } });
  }
}
