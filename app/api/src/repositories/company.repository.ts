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

  async create(data: CreateCompanyDTO): Promise<Company> {
    return this.prisma.company.create({ data });
  }

  async update(id: string, data: UpdateCompanyDTO): Promise<Company> {
    return this.prisma.company.update({ where: { id }, data });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.company.delete({ where: { id } });
  }
}
