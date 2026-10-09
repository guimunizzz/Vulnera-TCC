import type { PrismaClient } from "@prisma/client";
import type { ProjectMember, ProjectMemberWithUser } from "../models/project-member.model";

export class ProjectMemberRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByProject(projectId: string): Promise<ProjectMemberWithUser[]> {
    // A lista autorizada resolve os nomes sem expor o cadastro completo do User.
    return this.prisma.projectMember.findMany({
      where: { projectId }, orderBy: { createdAt: "asc" },
      include: { user: { select: { name: true } } },
    });
  }

  async findOne(projectId: string, userId: string): Promise<ProjectMember | null> {
    return this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });
  }

  async create(projectId: string, userId: string): Promise<ProjectMemberWithUser> {
    return this.prisma.projectMember.create({
      data: { projectId, userId },
      include: { user: { select: { name: true } } },
    });
  }

  async delete(projectId: string, userId: string): Promise<void> {
    await this.prisma.projectMember.delete({
      where: { projectId_userId: { projectId, userId } },
    });
  }

  /** RN19 (maturidade) — "PENTESTER atribuído" à company: membro de ao menos um projeto dela. */
  async existsForUserInCompany(userId: string, companyId: string): Promise<boolean> {
    const found = await this.prisma.projectMember.findFirst({
      where: { userId, project: { companyId } },
      select: { id: true },
    });
    return !!found;
  }

  /** Companies whose projects the PENTESTER is assigned to. */
  async findCompanyIdsByUser(userId: string): Promise<string[]> {
    const memberships = await this.prisma.projectMember.findMany({
      where: { userId },
      select: { project: { select: { companyId: true } } },
    });
    return [...new Set(memberships.map((membership) => membership.project.companyId))];
  }
}
