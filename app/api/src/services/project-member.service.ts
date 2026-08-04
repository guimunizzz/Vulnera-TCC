/**
 * project-member.service.ts
 *
 * Gestão de quem está atribuído a um Project (RN08). Só ADMIN gerencia —
 * a checagem de role fica na rota (requireRole), aqui só as regras de negócio:
 * alvo precisa ser PENTESTER e o par (project, user) precisa ser único.
 */

import type { ProjectMemberRepository } from "../repositories/project-member.repository";
import type { ProjectRepository } from "../repositories/project.repository";
import type { UserRepository } from "../repositories/user.repository";
import { ProjectMemberEntity } from "../models/project-member.model";

export class ProjectMemberService {
  constructor(
    private readonly repository: ProjectMemberRepository,
    private readonly projectRepository: ProjectRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async list(projectId: string): Promise<ProjectMemberEntity[]> {
    const project = await this.projectRepository.findById(projectId);
    if (!project) throw new Error("PROJECT_NOT_FOUND");

    return (await this.repository.findByProject(projectId)).map((m) => new ProjectMemberEntity(m));
  }

  async add(projectId: string, userId: string): Promise<ProjectMemberEntity> {
    const project = await this.projectRepository.findById(projectId);
    if (!project) throw new Error("PROJECT_NOT_FOUND");

    const target = await this.userRepository.findById(userId);
    if (!target) throw new Error("USER_NOT_FOUND");
    if (target.role !== "PENTESTER") throw new Error("USER_NOT_PENTESTER");

    const existing = await this.repository.findOne(projectId, userId);
    if (existing) throw new Error("MEMBER_ALREADY_EXISTS");

    const created = await this.repository.create(projectId, userId);
    return new ProjectMemberEntity(created);
  }

  async remove(projectId: string, userId: string): Promise<void> {
    const project = await this.projectRepository.findById(projectId);
    if (!project) throw new Error("PROJECT_NOT_FOUND");

    const existing = await this.repository.findOne(projectId, userId);
    if (!existing) throw new Error("MEMBER_NOT_FOUND");

    await this.repository.delete(projectId, userId);
  }
}
