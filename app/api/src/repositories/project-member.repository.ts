import type { PrismaClient } from "@prisma/client";
import type { ProjectMember } from "../models/project-member.model";

export class ProjectMemberRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByProject(projectId: string): Promise<ProjectMember[]> {
    return this.prisma.projectMember.findMany({ where: { projectId }, orderBy: { createdAt: "asc" } });
  }

  async findOne(projectId: string, userId: string): Promise<ProjectMember | null> {
    return this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });
  }

  async create(projectId: string, userId: string): Promise<ProjectMember> {
    return this.prisma.projectMember.create({ data: { projectId, userId } });
  }

  async delete(projectId: string, userId: string): Promise<void> {
    await this.prisma.projectMember.delete({
      where: { projectId_userId: { projectId, userId } },
    });
  }
}
