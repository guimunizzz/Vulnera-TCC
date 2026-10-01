import type { PrismaClient } from "@prisma/client";
import type { Application, CreateApplicationDTO, UpdateApplicationDTO } from "../models/application.model";

export class ApplicationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Application | null> {
    return this.prisma.application.findUnique({ where: { id } });
  }

  async findAll(): Promise<Application[]> {
    return this.prisma.application.findMany({ where: { isActive: true }, orderBy: { createdAt: "desc" } });
  }

  async findByCompany(companyId: string): Promise<Application[]> {
    return this.prisma.application.findMany({
      where: { companyId, isActive: true },
      orderBy: { createdAt: "desc" },
    });
  }

  /** Usado pelo gate do RN03 — conta só as ativas, a soft-deletada não ocupa vaga do plano. */
  async countActiveByCompany(companyId: string): Promise<number> {
    return this.prisma.application.count({ where: { companyId, isActive: true } });
  }

  async create(companyId: string, data: CreateApplicationDTO): Promise<Application> {
    return this.prisma.application.create({
      data: {
        name: data.name,
        url: data.url,
        environment: data.environment ?? "PROD",
        techStack: data.techStack,
        description: data.description,
        companyId,
        // Contexto de risco (CP-1). `undefined` deixa o default do schema
        // valer (MEDIUM / false / INTERNAL) — só grava o que veio explícito.
        ...(data.criticality !== undefined ? { criticality: data.criticality } : {}),
        ...(data.internetFacing !== undefined ? { internetFacing: data.internetFacing } : {}),
        ...(data.dataSensitivity !== undefined ? { dataSensitivity: data.dataSensitivity } : {}),
        ...(data.businessOwner !== undefined ? { businessOwner: data.businessOwner } : {}),
        ...(data.technicalOwner !== undefined ? { technicalOwner: data.technicalOwner } : {}),
      },
    });
  }

  async update(id: string, data: UpdateApplicationDTO): Promise<Application> {
    return this.prisma.application.update({ where: { id }, data });
  }

  /**
   * Todas as aplicações de uma empresa, ativas ou não — o recorte do grafo e
   * do recálculo de VRS. Sem filtro de `isActive` de propósito: uma app
   * desativada ainda tem findings, e eles ainda têm contexto.
   */
  async findAllByCompanyIncludingInactive(companyId: string): Promise<Application[]> {
    return this.prisma.application.findMany({ where: { companyId }, orderBy: { name: "asc" } });
  }

  /** RN04: exclusão é soft delete via isActive — nunca DELETE físico. */
  async deactivate(id: string): Promise<Application> {
    return this.prisma.application.update({ where: { id }, data: { isActive: false } });
  }
}
