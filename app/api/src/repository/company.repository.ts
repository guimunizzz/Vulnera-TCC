import { prisma } from '../database/prisma.database';

export class CompanyRepository {
  async selectAll() {
    return prisma.company.findMany();
  }

  async selectById(id: string) {
    return prisma.company.findUnique({
      where: { id },
    });
  }

  async insert(company: { name: string; planId: string }) {
    return prisma.company.create({
      data: company,
    });
  }

  async update(id: string, company: { name: string; planId: string }) {
    return prisma.company.update({
      where: { id },
      data: company,
    });
  }

  async delete(id: string) {
    return prisma.company.delete({
      where: { id },
    });
  }
}