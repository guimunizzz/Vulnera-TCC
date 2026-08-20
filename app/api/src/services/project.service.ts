/**
 * project.service.ts
 *
 * Máquina de estados mínima (4 estados — a formal de 7 estados do vault fica
 * pra sprint futura, conforme comentário no schema.prisma):
 *   PENDING → IN_PROGRESS → IN_REVIEW → COMPLETED
 *   IN_REVIEW → IN_PROGRESS (retrabalho)
 *
 * RN05/RN06: 1-para-1 com Application e companyId sempre herdado dela — nunca
 * aceito do DTO. RN17: PENTESTER só enxerga projetos onde é ProjectMember.
 * Toda transição grava AuditLog STATUS_CHANGE.
 */

import type { ProjectRepository } from "../repositories/project.repository";
import type { ApplicationRepository } from "../repositories/application.repository";
import type { UserRepository } from "../repositories/user.repository";
import type { ProjectMemberRepository } from "../repositories/project-member.repository";
import type { AuditLogRepository } from "../repositories/audit-log.repository";
import { ProjectEntity, type CreateProjectDTO, type ProjectStatus, type UpdateProjectDTO } from "../models/project.model";
import type { Project } from "@prisma/client";
import type { UserRole } from "../models/user.model";

interface Actor {
  userId: string;
  role: UserRole;
}

const ALLOWED_TRANSITIONS: Record<string, ProjectStatus[]> = {
  PENDING: ["IN_PROGRESS"],
  IN_PROGRESS: ["IN_REVIEW"],
  IN_REVIEW: ["COMPLETED", "IN_PROGRESS"],
  COMPLETED: [],
};

export class ProjectService {
  constructor(
    private readonly repository: ProjectRepository,
    private readonly applicationRepository: ApplicationRepository,
    private readonly userRepository: UserRepository,
    private readonly projectMemberRepository: ProjectMemberRepository,
    private readonly auditLogRepository: AuditLogRepository,
  ) {}

  async list(actor: Actor): Promise<ProjectEntity[]> {
    if (actor.role === "ADMIN") {
      return (await this.repository.findAll()).map((p) => new ProjectEntity(p));
    }
    if (actor.role === "CLIENT") {
      const user = await this.userRepository.findById(actor.userId);
      if (!user?.companyId) return [];
      return (await this.repository.findByCompany(user.companyId)).map((p) => new ProjectEntity(p));
    }
    // PENTESTER — RN17
    return (await this.repository.findByMember(actor.userId)).map((p) => new ProjectEntity(p));
  }

  async getById(actor: Actor, id: string): Promise<ProjectEntity> {
    const project = await this.repository.findById(id);
    if (!project) throw new Error("PROJECT_NOT_FOUND");
    await this.assertCanView(actor, project);
    return new ProjectEntity(project);
  }

  async create(actor: Actor, dto: CreateProjectDTO): Promise<ProjectEntity> {
    if (actor.role === "PENTESTER") throw new Error("FORBIDDEN");

    const application = await this.applicationRepository.findById(dto.applicationId);
    if (!application) throw new Error("APPLICATION_NOT_FOUND");

    if (actor.role === "CLIENT") {
      const user = await this.userRepository.findById(actor.userId);
      if (!user?.companyId || user.companyId !== application.companyId) throw new Error("FORBIDDEN");
    }

    // RN05 — 1-para-1 (sem @unique no schema; invariante garantida aqui)
    const existing = await this.repository.findByApplication(dto.applicationId);
    if (existing) throw new Error("APPLICATION_ALREADY_HAS_PROJECT");

    const created = await this.repository.create({
      applicationId: application.id,
      companyId: application.companyId, // RN06 — herdado, nunca do body
      name: dto.name,
      description: dto.description,
      analysisType: dto.analysisType ?? "DAST",
      analysisLevel: dto.analysisLevel ?? "BASIC",
      hasRemediation: dto.hasRemediation ?? false,
      scopeIn: dto.scopeIn,
      scopeOut: dto.scopeOut,
      notes: dto.notes,
    });

    return new ProjectEntity(created);
  }

  /** Metadados (nome, escopo, notas...) — PENTESTER não edita, só transiciona status. */
  async update(actor: Actor, id: string, dto: UpdateProjectDTO): Promise<ProjectEntity> {
    if (actor.role === "PENTESTER") throw new Error("FORBIDDEN");

    const project = await this.repository.findById(id);
    if (!project) throw new Error("PROJECT_NOT_FOUND");
    await this.assertCanEditMetadata(actor, project);

    const updated = await this.repository.update(id, dto);
    return new ProjectEntity(updated);
  }

  async transition(actor: Actor, id: string, toStatus: ProjectStatus): Promise<ProjectEntity> {
    const project = await this.repository.findById(id);
    if (!project) throw new Error("PROJECT_NOT_FOUND");

    if (actor.role === "CLIENT") throw new Error("FORBIDDEN");
    if (actor.role === "PENTESTER") {
      const membership = await this.projectMemberRepository.findOne(id, actor.userId);
      if (!membership) throw new Error("FORBIDDEN");
    }
    // ADMIN sempre pode mover (RN15)

    const allowed = ALLOWED_TRANSITIONS[project.status] ?? [];
    if (!allowed.includes(toStatus)) throw new Error("INVALID_STATUS_TRANSITION");

    const extra: { startedAt?: Date; closedAt?: Date } = {};
    if (toStatus === "IN_PROGRESS" && !project.startedAt) extra.startedAt = new Date();
    if (toStatus === "COMPLETED") extra.closedAt = new Date();

    const updated = await this.repository.updateStatus(id, toStatus, extra);

    await this.auditLogRepository.create({
      actorId: actor.userId,
      companyId: project.companyId,
      entityType: "Project",
      entityId: id,
      action: "STATUS_CHANGE",
      diffJson: JSON.stringify({ from: project.status, to: toStatus }),
    });

    return new ProjectEntity(updated);
  }

  /** RN16 (CLIENT) + RN17 (PENTESTER via ProjectMember). */
  private async assertCanView(actor: Actor, project: Project): Promise<void> {
    if (actor.role === "ADMIN") return;
    if (actor.role === "CLIENT") {
      const user = await this.userRepository.findById(actor.userId);
      if (user?.companyId && user.companyId === project.companyId) return;
      throw new Error("FORBIDDEN");
    }
    const membership = await this.projectMemberRepository.findOne(project.id, actor.userId);
    if (!membership) throw new Error("FORBIDDEN");
  }

  private async assertCanEditMetadata(actor: Actor, project: Project): Promise<void> {
    if (actor.role === "ADMIN") return;
    const user = await this.userRepository.findById(actor.userId);
    if (user?.companyId && user.companyId === project.companyId) return;
    throw new Error("FORBIDDEN");
  }
}
