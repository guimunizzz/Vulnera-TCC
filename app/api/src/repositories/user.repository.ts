/**
 * user.repository.ts
 *
 * Acesso ao DB para a entidade User. Sem lógica de negócio aqui — só CRUD.
 * Cliente Prisma ou transacional injetado por construtor (DI manual via factory).
 */

import type { Prisma, User } from "@prisma/client";
import type { AssigneeCandidateDTO, UserRole } from "../models/user.model";
import type { AccessDatabaseClient } from "./access-transaction.repository";

export interface CreateUserData {
  name: string;
  email: string;
  password: string;
  role?: UserRole;
  companyId?: string | null;
  companyRole?: string | null;
  legacyOnboardingAllowed?: boolean;
}

export class UserRepository {
  constructor(private readonly prisma: AccessDatabaseClient) {}

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  /** Projeção mínima para o bucket de tenant; nunca decide autorização. */
  async findCompanyIdById(id: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({ where: { id }, select: { companyId: true } });
    return user?.companyId ?? null;
  }

  findAll(filters: { companyId?: string; includeDeactivated?: boolean } = {}): Promise<User[]> {
    return this.prisma.user.findMany({
      where: {
        ...(filters.companyId ? { companyId: filters.companyId } : {}),
        ...(!filters.includeDeactivated ? { deactivatedAt: null } : {}),
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /** Bloqueia a identidade durante uma operação transacional de sessão/conta. */
  async lockById(id: string): Promise<User | null> {
    if ("$transaction" in this.prisma) throw new Error("USER_LOCK_REQUIRES_TRANSACTION");
    const rows = await this.prisma.$queryRaw<User[]>`SELECT * FROM \`User\` WHERE id = ${id} FOR UPDATE`;
    return rows[0] ?? null;
  }

  /** Bloqueia os membros em ordem estável depois de bloquear a linha Company. */
  async lockCompanyMembers(companyId: string): Promise<User[]> {
    if ("$transaction" in this.prisma) throw new Error("USER_LOCK_REQUIRES_TRANSACTION");
    return this.prisma.$queryRaw<User[]>`
      SELECT * FROM \`User\` WHERE companyId = ${companyId} ORDER BY id FOR UPDATE
    `;
  }

  /** Apendeia a transição de conta dentro da mesma transação da mudança. */
  recordAccountLifecycle(
    actorId: string,
    companyId: string | null,
    userId: string,
    action: "USER_DEACTIVATED" | "OWNER_REACTIVATED",
    now: Date,
  ): Promise<unknown> {
    return this.prisma.auditLog.create({
      data: {
        actorId,
        companyId,
        entityType: "User",
        entityId: userId,
        action,
        createdAt: now,
      },
    });
  }

  /** Desativa sem apagar histórico e invalida todas as credenciais da conta. */
  async markDeactivated(id: string, now: Date): Promise<User> {
    if ("$transaction" in this.prisma) throw new Error("USER_DEACTIVATION_REQUIRES_TRANSACTION");
    await this.prisma.user.updateMany({
      where: { id, deactivatedAt: null },
      data: { deactivatedAt: now, sessionVersion: { increment: 1 }, expoPushToken: null },
    });
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new Error("USER_NOT_FOUND");
    return user;
  }

  /** Reativa apenas o OWNER histórico; sessões antigas nunca são restauradas. */
  async reactivateOwner(id: string, now: Date): Promise<User> {
    if ("$transaction" in this.prisma) throw new Error("USER_REACTIVATION_REQUIRES_TRANSACTION");
    const result = await this.prisma.user.updateMany({
      where: { id, role: "CLIENT", companyRole: "OWNER", deactivatedAt: { not: null } },
      data: { deactivatedAt: null, sessionVersion: { increment: 1 }, expoPushToken: null, updatedAt: now },
    });
    if (result.count !== 1) throw new Error("OWNER_RECOVERY_NOT_AVAILABLE");
    return this.prisma.user.findUniqueOrThrow({ where: { id } });
  }

  /** Responsáveis elegíveis, sem vazar email/company de admins globais. */
  findEligibleAssignees(projectId: string, companyId: string): Promise<AssigneeCandidateDTO[]> {
    return this.prisma.user.findMany({
      where: {
        deactivatedAt: null,
        OR: [
          { role: "ADMIN" },
          { role: "CLIENT", companyId },
          { role: "PENTESTER", projectMembers: { some: { projectId } } },
        ],
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  }

  /** Responsáveis para o filtro do quadro, agregados pelos projetos visíveis. */
  findEligibleAssigneesForProjects(projectIds: string[], companyIds: string[]): Promise<AssigneeCandidateDTO[]> {
    if (projectIds.length === 0 && companyIds.length === 0) return Promise.resolve([]);
    const regras: Prisma.UserWhereInput[] = [{ role: "ADMIN" }];
    if (companyIds.length > 0) regras.push({ role: "CLIENT", companyId: { in: companyIds } });
    if (projectIds.length > 0) regras.push({ role: "PENTESTER", projectMembers: { some: { projectId: { in: projectIds } } } });
    return this.prisma.user.findMany({
      where: { deactivatedAt: null, OR: regras },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  }

  /** Resolução em lote (ex: nomes de autor/responsável no report-data) — evita N+1 chamada a chamada. */
  findByIds(ids: string[]): Promise<User[]> {
    if (ids.length === 0) return Promise.resolve([]);
    return this.prisma.user.findMany({ where: { id: { in: ids } } });
  }

  async create(
    data: CreateUserData,
    options: { uniqueEmailConflictCode?: string } = {},
  ): Promise<User> {
    try {
      return await this.prisma.user.create({
        data: {
          name: data.name,
          email: data.email,
          password: data.password,
          role: data.role ?? "CLIENT",
          companyId: data.companyId ?? null,
          ...(data.companyRole !== undefined ? { companyRole: data.companyRole } : {}),
          ...(data.legacyOnboardingAllowed !== undefined ? { legacyOnboardingAllowed: data.legacyOnboardingAllowed } : {}),
        },
      });
    } catch (error) {
      // O fluxo de ativação só grava campos sem outras chaves únicas além de User.email.
      if (options.uniqueEmailConflictCode && isUniqueConstraintViolation(error)) {
        throw new Error(options.uniqueEmailConflictCode);
      }
      throw error;
    }
  }

  update(id: string, data: Partial<{ name: string }>): Promise<User> {
    return this.prisma.user.update({ where: { id }, data });
  }

  /** Fase 7 (push) — token do Expo Push Service capturado pelo app mobile no login. */
  updateExpoPushToken(id: string, expoPushToken: string): Promise<User> {
    return this.prisma.user.update({ where: { id }, data: { expoPushToken } });
  }

  /** Usado pelo disparo de push (RN20-like em CRITICAL): só quem tem token registrado. */
  findClientsWithPushToken(companyId: string): Promise<User[]> {
    return this.prisma.user.findMany({
      where: { companyId, role: "CLIENT", deactivatedAt: null, expoPushToken: { not: null } },
    });
  }

  /** Vincula o usuário a uma company recém-criada, tornando-o dono dela. */
  setCompanyOwnership(userId: string, companyId: string, companyRole: string): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { companyId, companyRole },
    });
  }

}

function isUniqueConstraintViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null
    && "code" in error && (error as { code?: unknown }).code === "P2002";
}
