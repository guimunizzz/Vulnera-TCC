/**
 * projects.fixture.ts
 *
 * Helper para criar projects (e opcionalmente membros) direto no banco de
 * teste (bypass da API).
 */

import { prisma } from "../../src/database/prisma.database";
import type { Project, ProjectMember } from "@prisma/client";

export interface SeedProjectInput {
  name: string;
  applicationId: string;
  companyId: string;
  status?: string;
}

export async function seedProject(input: SeedProjectInput): Promise<Project> {
  return prisma.project.create({
    data: {
      name: input.name,
      applicationId: input.applicationId,
      companyId: input.companyId,
      status: input.status ?? "PENDING",
    },
  });
}

export async function seedProjectMember(projectId: string, userId: string): Promise<ProjectMember> {
  return prisma.projectMember.create({ data: { projectId, userId } });
}
