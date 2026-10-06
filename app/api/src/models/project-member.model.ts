import type { ProjectMember as PrismaProjectMember } from "@prisma/client";

// === TYPE ===================================================================
export type ProjectMember = PrismaProjectMember;
export type ProjectMemberWithUser = ProjectMember & { user: { name: string } };

// === DTOs ===================================================================
export type AddProjectMemberDTO = {
  userId: string;
};

export type ProjectMemberResponseDTO = {
  id: string;
  projectId: string;
  userId: string;
  userName: string;
  createdAt: string;
};

// === ENTITY =================================================================
export class ProjectMemberEntity {
  constructor(private readonly data: ProjectMemberWithUser) {}

  toResponse(): ProjectMemberResponseDTO {
    return {
      id: this.data.id,
      projectId: this.data.projectId,
      userId: this.data.userId,
      userName: this.data.user.name,
      createdAt: this.data.createdAt.toISOString(),
    };
  }
}
