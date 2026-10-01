import type { PrismaClient } from "@prisma/client";
import type { Project } from "../models/project.model";

export interface CreateProjectData {
  applicationId: string;
  companyId: string;
  name: string;
  description?: string;
  analysisType: string;
  analysisLevel: string;
  hasRemediation: boolean;
  scopeIn?: string;
  scopeOut?: string;
  notes?: string;
}

export interface UpdateProjectData {
  name?: string;
  description?: string;
  analysisType?: string;
  analysisLevel?: string;
  hasRemediation?: boolean;
  scopeIn?: string;
  scopeOut?: string;
  notes?: string;
}

export class ProjectRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Project | null> {
    return this.prisma.project.findUnique({ where: { id } });
  }

  /** RN05 — a busca bloqueia duplicatas sequenciais; não protege contra corrida sem constraint no banco. */
  async findByApplication(applicationId: string): Promise<Project | null> {
    return this.prisma.project.findFirst({ where: { applicationId } });
  }

  /** Conta só projetos simultâneos; concluídos liberam a vaga do plano. */
  async countSimultaneousByCompany(companyId: string): Promise<number> {
    return this.prisma.project.count({
      where: {
        companyId,
        status: { in: ["PENDING", "IN_PROGRESS", "IN_REVIEW"] },
      },
    });
  }

  async findAll(): Promise<Project[]> {
    return this.prisma.project.findMany({ orderBy: { requestedAt: "desc" } });
  }

  async findByCompany(companyId: string): Promise<Project[]> {
    return this.prisma.project.findMany({ where: { companyId }, orderBy: { requestedAt: "desc" } });
  }

  /** RN17 — pentester só vê projetos onde é membro. */
  async findByMember(userId: string): Promise<Project[]> {
    return this.prisma.project.findMany({
      where: { members: { some: { userId } } },
      orderBy: { requestedAt: "desc" },
    });
  }

  async create(data: CreateProjectData): Promise<Project> {
    return this.prisma.project.create({ data });
  }

  async update(id: string, data: UpdateProjectData): Promise<Project> {
    return this.prisma.project.update({ where: { id }, data });
  }

  async updateStatus(id: string, status: string, extra: { startedAt?: Date; closedAt?: Date }): Promise<Project> {
    return this.prisma.project.update({ where: { id }, data: { status, ...extra } });
  }
}
