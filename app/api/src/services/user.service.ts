/**
 * Regras de leitura, edição e ciclo de vida da conta User.
 * A camada preserva vínculos históricos e encerra as credenciais em conjunto.
 */

import type { User } from "@prisma/client";
import { UserEntity, type UserResponseDTO, type UserRole } from "../models/user.model";
import type { UserRepository } from "../repositories/user.repository";
import type { RefreshTokenRepository } from "../repositories/refresh-token.repository";

interface Actor {
  userId: string;
  role: UserRole;
}

export class UserService {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly refreshRepo: RefreshTokenRepository,
  ) {}

  async getById(actor: Actor, id: string): Promise<UserResponseDTO> {
    const target = await this.userRepo.findById(id);
    if (!target || (target.deactivatedAt && actor.role !== "ADMIN")) throw new Error("USER_NOT_FOUND");

    if (actor.role === "PENTESTER" && actor.userId !== target.id) throw new Error("FORBIDDEN");
    if (actor.role === "CLIENT" && actor.userId !== target.id) {
      const me = await this.userRepo.findById(actor.userId);
      if (!me?.companyId || me.deactivatedAt || me.companyId !== target.companyId) throw new Error("FORBIDDEN");
    }
    return UserEntity.toResponse(target);
  }

  async list(actor: Actor): Promise<UserResponseDTO[]> {
    if (actor.role === "ADMIN") {
      const all = await this.userRepo.findAll({ includeDeactivated: true });
      return all.map(UserEntity.toResponse);
    }
    if (actor.role === "CLIENT") {
      const me = await this.userRepo.findById(actor.userId);
      if (!me?.companyId || me.deactivatedAt) return [];
      const filtered = await this.userRepo.findAll({ companyId: me.companyId });
      return filtered.map(UserEntity.toResponse);
    }
    const me = await this.userRepo.findById(actor.userId);
    return me && !me.deactivatedAt ? [UserEntity.toResponse(me)] : [];
  }

  async update(actor: Actor, id: string, data: { name?: string; email?: string }): Promise<UserResponseDTO> {
    if (actor.role !== "ADMIN" && actor.userId !== id) throw new Error("FORBIDDEN");
    const current = await this.userRepo.findById(id);
    if (!current || (current.deactivatedAt && actor.role !== "ADMIN")) throw new Error("USER_NOT_FOUND");
    if (data.email !== undefined && data.email !== current.email) {
      throw new Error("EMAIL_CHANGE_REQUIRES_VERIFICATION");
    }
    const updated = data.name === undefined ? current : await this.userRepo.update(id, { name: data.name });
    return UserEntity.toResponse(updated);
  }

  /** Mantém o contrato DELETE, mas preserva histórico e encerra a sessão. */
  async delete(actor: Actor, id: string): Promise<void> {
    if (actor.userId === id) throw new Error("SELF_DELETE_FORBIDDEN");
    if (actor.role !== "ADMIN") throw new Error("FORBIDDEN");
    const observed = await this.userRepo.findById(id);
    if (!observed) throw new Error("USER_NOT_FOUND");

    const now = new Date();
    await this.refreshRepo.transaction(async ({ users, refreshTokens, tenantLocks }) => {
      const { target, companyMembers } = await this.lockTargetAndCompanyUsers(users, tenantLocks, observed);
      if (!target) throw new Error("USER_STATE_CHANGED");

      if (
        !target.deactivatedAt && target.role === "CLIENT" &&
        target.companyRole === "OWNER" &&
        companyMembers.filter((user) => user.role === "CLIENT" && user.companyRole === "OWNER" && !user.deactivatedAt).length <= 1
      ) {
        throw new Error("LAST_ACTIVE_OWNER");
      }

      const wasActive = target.deactivatedAt === null;
      await users.markDeactivated(id, now);
      await refreshTokens.revokeAllForUser(id, now);
      if (wasActive) {
        await users.recordAccountLifecycle(actor.userId, target.companyId, id, "USER_DEACTIVATED", now);
      }
    });
  }

  /** Reabre apenas um OWNER histórico; nunca recupera tokens ou outras sessões. */
  async reactivateOwner(actor: Actor, id: string): Promise<UserResponseDTO> {
    if (actor.role !== "ADMIN") throw new Error("FORBIDDEN");
    const observed = await this.userRepo.findById(id);
    if (!observed) throw new Error("USER_NOT_FOUND");
    if (
      !observed.deactivatedAt || observed.role !== "CLIENT" ||
      observed.companyRole !== "OWNER" || !observed.companyId
    ) {
      throw new Error("OWNER_RECOVERY_NOT_AVAILABLE");
    }

    const now = new Date();
    const reactivated = await this.refreshRepo.transaction(async ({ users, refreshTokens, tenantLocks }) => {
      const company = await tenantLocks.lockCompany(observed.companyId!);
      if (!company) throw new Error("OWNER_RECOVERY_NOT_AVAILABLE");
      const members = await users.lockCompanyMembers(observed.companyId!);
      const target = members.find((user) => user.id === id);
      if (
        !target || target.companyId !== observed.companyId || !target.deactivatedAt ||
        target.role !== "CLIENT" || target.companyRole !== "OWNER"
      ) {
        throw new Error("OWNER_RECOVERY_NOT_AVAILABLE");
      }
      const activeOwner = members.some((user) =>
        user.id !== id && user.role === "CLIENT" && user.companyRole === "OWNER" && !user.deactivatedAt,
      );
      if (activeOwner) throw new Error("COMPANY_ALREADY_HAS_ACTIVE_OWNER");

      const user = await users.reactivateOwner(id, now);
      await refreshTokens.revokeAllForUser(id, now);
      await users.recordAccountLifecycle(actor.userId, user.companyId, id, "OWNER_REACTIVATED", now);
      return user;
    });
    return UserEntity.toResponse(reactivated);
  }

  private async lockTargetAndCompanyUsers(
    users: UserRepository,
    tenantLocks: { lockCompany(companyId: string): Promise<{ id: string } | null> },
    observed: User,
  ): Promise<{ target: User | null; companyMembers: User[] }> {
    if (observed.companyId) {
      const company = await tenantLocks.lockCompany(observed.companyId);
      if (!company) return { target: null, companyMembers: [] };
      const members = await users.lockCompanyMembers(observed.companyId);
      const target = members.find((user) => user.id === observed.id);
      return { target: target?.companyId === observed.companyId ? target : null, companyMembers: members };
    }

    const target = await users.lockById(observed.id);
    return { target: target?.companyId === null ? target : null, companyMembers: [] };
  }
}
