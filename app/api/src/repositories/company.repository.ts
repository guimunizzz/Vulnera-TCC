import type { PrismaClient } from "@prisma/client";
import type {
  Company,
  CreateCompanyDTO,
  UpdateCompanyDTO,
} from "../models/company.model";

export class CompanyRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Company | null> {
    return this.prisma.company.findUnique({ where: { id } });
  }

  async findAll(): Promise<Company[]> {
    return this.prisma.company.findMany({ orderBy: { createdAt: "desc" } });
  }

  async findByCnpj(cnpj: string): Promise<Company | null> {
    return this.prisma.company.findUnique({ where: { cnpj } });
  }

  async create(data: CreateCompanyDTO): Promise<Company> {
    return this.prisma.company.create({ data });
  }

  async update(id: string, data: UpdateCompanyDTO): Promise<Company> {
    // Projeta o contrato também no acesso a dados para não expor relações do Prisma.
    return this.prisma.company.update({
      where: { id },
      data: { name: data.name, cnpj: data.cnpj, planId: data.planId },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.company.delete({ where: { id } });
  }
}
