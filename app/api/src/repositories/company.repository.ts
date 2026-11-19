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

  /**
   * Cria a empresa e a vincula ao primeiro OWNER na mesma transação.
   * O compare-and-set impede que duas abas vinculem empresas diferentes ao
   * mesmo usuário; se o vínculo perder a corrida, a empresa recém-criada volta.
   */
  async createWithOwner(userId: string, data: CreateCompanyDTO): Promise<Company> {
    return this.prisma.$transaction(async (tx) => {
      const company = await tx.company.create({ data });
      const claim = await tx.user.updateMany({
        where: { id: userId, companyId: null },
        data: { companyId: company.id, companyRole: "OWNER" },
      });

      if (claim.count !== 1) throw new Error("USER_ALREADY_HAS_COMPANY");
      return company;
    });
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
