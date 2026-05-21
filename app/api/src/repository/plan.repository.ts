import { prisma } from '../database/prisma.database';

export class PlanRepository {
  async selectAll() {
    return prisma.plan.findMany();
  }

  async selectById(id: string) {
    return prisma.plan.findUnique({
      where: { id },
    });
  }

  async insert(plan: { name: string; maxApplications: number; price: number }) {
    return prisma.plan.create({
      data: plan,
    });
  }

  async update(id: string, plan: { name: string; maxApplications: number; price: number }) {
    return prisma.plan.update({
      where: { id },
      data: plan,
    });
  }

  async delete(id: string) {
    return prisma.plan.delete({
      where: { id },
    });
  }
}