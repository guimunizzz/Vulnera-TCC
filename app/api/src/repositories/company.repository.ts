import type { PrismaClient } from "@prisma/client";
import { companyCnpjVariants } from "../utils/cnpj.util";
import { lockEligiblePlan } from "./plan.repository";
import { TenantLockRepository } from "./tenant-lock.repository";
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

  /**
   * Cria a empresa e a vincula ao primeiro OWNER na mesma transação.
   * O compare-and-set impede que duas abas vinculem empresas diferentes ao
   * mesmo usuário; se o vínculo perder a corrida, a empresa recém-criada volta.
   */
  async createWithOwner(userId: string, data: CreateCompanyDTO): Promise<Company> {
    return this.prisma.$transaction(async (tx) => {
      const locks = new TenantLockRepository(tx);
      await locks.lockUsers([userId]);
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user || user.role !== "CLIENT" || user.deactivatedAt) throw new Error("FORBIDDEN");
      if (user.companyId) {
        throw new Error(user.companyRole === "OWNER" ? "USER_ALREADY_HAS_COMPANY" : "FORBIDDEN");
      }
      if (!user.legacyOnboardingAllowed) throw new Error("FORBIDDEN");

      await lockEligiblePlan(tx, data.planId);
      if (data.cnpj && await tx.company.findFirst({ where: { cnpj: { in: companyCnpjVariants(data.cnpj) } } })) {
        throw new Error("COMPANY_ALREADY_EXISTS");
      }

      const company = await tx.company.create({ data });
      const claim = await tx.user.updateMany({
        where: { id: userId, companyId: null, legacyOnboardingAllowed: true, deactivatedAt: null },
        data: { companyId: company.id, companyRole: "OWNER", legacyOnboardingAllowed: false },
      });

      if (claim.count !== 1) throw new Error("USER_ALREADY_HAS_COMPANY");
      return company;
    }, { isolationLevel: "ReadCommitted" });
  }

  async update(id: string, actorId: string, data: UpdateCompanyDTO): Promise<Company> {
    return this.prisma.$transaction(async (tx) => {
      const locks = new TenantLockRepository(tx);
      const company = await locks.lockCompany(id);
      await locks.lockUsers([actorId]);
      const actor = await tx.user.findUnique({ where: { id: actorId } });
      if (!actor || actor.deactivatedAt || (actor.role !== "ADMIN" &&
        (actor.role !== "CLIENT" || actor.companyRole !== "OWNER" || actor.companyId !== id))) {
        throw new Error("FORBIDDEN");
      }
      if (!company) throw new Error("COMPANY_NOT_FOUND");
      if (data.planId !== undefined) {
        if (actor.role !== "ADMIN") throw new Error("FORBIDDEN");
        await lockEligiblePlan(tx, data.planId);
        const active = await tx.subscription.findFirst({ where: { companyId: id, status: "ACTIVE" } });
        if (active && active.planId !== data.planId) throw new Error("ALREADY_HAS_ACTIVE_SUBSCRIPTION");
      }
      if (data.cnpj && await tx.company.findFirst({
        where: { id: { not: id }, cnpj: { in: companyCnpjVariants(data.cnpj) } },
      })) {
        throw new Error("COMPANY_ALREADY_EXISTS");
      }
      // Projeção explícita impede mutação de relações pelo contrato de perfil.
      return tx.company.update({ where: { id }, data: { name: data.name, cnpj: data.cnpj, planId: data.planId } });
    }, { isolationLevel: "ReadCommitted" });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.company.delete({ where: { id } });
  }
}
