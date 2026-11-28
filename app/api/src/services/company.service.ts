import { CompanyRepository } from "../repositories/company.repository";
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
    const created = await this.repository.createWithOwner(actor.userId, dto).catch(handleCompanyWriteError);
    return new CompanyEntity(created);
  }

  async update(actor: Actor, id: string, dto: UpdateCompanyDTO): Promise<CompanyEntity> {
    const updated = await this.repository.update(id, actor.userId, dto).catch(handleCompanyWriteError);
    return new CompanyEntity(updated);
  }

  async delete(id: string): Promise<void> {
    await this.getById(id);
    try {
      await this.repository.delete(id);
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "P2003") {
        throw new Error("COMPANY_HAS_HISTORY");
      }
      throw error;
    }
  }
}

function handleCompanyWriteError(error: unknown): never {
  if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
    throw new Error("COMPANY_ALREADY_EXISTS");
  }
  throw error;
}
