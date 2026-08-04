import { CompanyRepository } from "../repositories/company.repository";
import { PlanRepository } from "../repositories/plan.repository";
import { UserRepository } from "../repositories/user.repository";
import {
  CompanyEntity,
  CreateCompanyDTO,
  UpdateCompanyDTO,
} from "../models/company.model";
import type { UserRole } from "../models/user.model";

interface Actor {
  userId: string;
  role: UserRole;
}

export class CompanyService {
  constructor(
    private readonly repository: CompanyRepository,
    private readonly planRepository: PlanRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async getById(id: string): Promise<CompanyEntity> {
    const company = await this.repository.findById(id);
    if (!company) throw new Error("COMPANY_NOT_FOUND");
    return new CompanyEntity(company);
  }

  /** GET /companies/me — company do próprio usuário autenticado. */
  async getMine(actor: Actor): Promise<CompanyEntity> {
    const user = await this.userRepository.findById(actor.userId);
    if (!user?.companyId) throw new Error("USER_HAS_NO_COMPANY");
    return this.getById(user.companyId);
  }

  async list(): Promise<CompanyEntity[]> {
    const companies = await this.repository.findAll();
    return companies.map((c) => new CompanyEntity(c));
  }

  /** Quem cria vira dono (User.companyId + companyRole="OWNER"). */
  async create(actor: Actor, dto: CreateCompanyDTO): Promise<CompanyEntity> {
    const user = await this.userRepository.findById(actor.userId);
    if (user?.companyId) throw new Error("USER_ALREADY_HAS_COMPANY");

    const plan = await this.planRepository.findById(dto.planId);
    if (!plan) throw new Error("PLAN_NOT_FOUND");

    if (dto.cnpj) {
      const existing = await this.repository.findByCnpj(dto.cnpj);
      if (existing) throw new Error("COMPANY_ALREADY_EXISTS");
    }

    const created = await this.repository.create(dto);
    await this.userRepository.setCompanyOwnership(actor.userId, created.id, "OWNER");
    return new CompanyEntity(created);
  }

  async update(actor: Actor, id: string, dto: UpdateCompanyDTO): Promise<CompanyEntity> {
    await this.assertCanEdit(actor, id);

    if (dto.planId !== undefined) {
      const plan = await this.planRepository.findById(dto.planId);
      if (!plan) throw new Error("PLAN_NOT_FOUND");
    }
    if (dto.cnpj !== undefined) {
      const existing = await this.repository.findByCnpj(dto.cnpj);
      if (existing && existing.id !== id) throw new Error("COMPANY_ALREADY_EXISTS");
    }

    const updated = await this.repository.update(id, dto);
    return new CompanyEntity(updated);
  }

  async delete(id: string): Promise<void> {
    await this.getById(id);
    await this.repository.delete(id);
  }

  /** ADMIN edita qualquer company; CLIENT só a própria. */
  private async assertCanEdit(actor: Actor, id: string): Promise<void> {
    await this.getById(id);
    if (actor.role === "ADMIN") return;

    const user = await this.userRepository.findById(actor.userId);
    if (!user?.companyId || user.companyId !== id) throw new Error("FORBIDDEN");
  }
}
