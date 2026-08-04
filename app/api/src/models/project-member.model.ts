import type { ProjectMember as PrismaProjectMember } from "@prisma/client";

// === TYPE ===================================================================
export type ProjectMember = PrismaProjectMember;

// === DTOs ===================================================================
export type AddProjectMemberDTO = {
  userId: string;
};

export type ProjectMemberResponseDTO = {
  id: string;
  projectId: string;
  userId: string;
  createdAt: string;
};

// === ENTITY =================================================================
export class ProjectMemberEntity {
  constructor(private readonly data: ProjectMember) {}

  toResponse(): ProjectMemberResponseDTO {
    return {
      id: this.data.id,
      projectId: this.data.projectId,
      userId: this.data.userId,
      createdAt: this.data.createdAt.toISOString(),
    };
  }
}
