/**
 * user.service.ts
 *
 * Lógica do CRUD de usuário com regras de autorização por role.
 */

import { UserEntity, type UserResponseDTO, type UserRole } from "../models/user.model";
import type { UserRepository } from "../repositories/user.repository";

interface Actor {
  userId: string;
  role: UserRole;
}

export class UserService {
  constructor(private readonly userRepo: UserRepository) {}

  async getById(actor: Actor, id: string): Promise<UserResponseDTO> {
    const target = await this.userRepo.findById(id);
    if (!target) throw new Error("USER_NOT_FOUND");

    // pentester só vê a si mesmo
    if (actor.role === "PENTESTER" && actor.userId !== target.id) {
      throw new Error("FORBIDDEN");
    }
    // client só vê a si mesmo ou quem é da própria company
    if (actor.role === "CLIENT" && actor.userId !== target.id) {
      const me = await this.userRepo.findById(actor.userId);
      // companyId null não pode "casar" com companyId null de outro usuário
      if (!me?.companyId || me.companyId !== target.companyId) {
        throw new Error("FORBIDDEN");
      }
    }
    return UserEntity.toResponse(target);
  }

  async list(actor: Actor): Promise<UserResponseDTO[]> {
    if (actor.role === "ADMIN") {
      const all = await this.userRepo.findAll();
      return all.map(UserEntity.toResponse);
    }
    if (actor.role === "CLIENT") {
      const me = await this.userRepo.findById(actor.userId);
      if (!me?.companyId) return [];
      const filtered = await this.userRepo.findAll({ companyId: me.companyId });
      return filtered.map(UserEntity.toResponse);
    }
    // pentester: só ele mesmo
    const me = await this.userRepo.findById(actor.userId);
    return me ? [UserEntity.toResponse(me)] : [];
  }

  async update(actor: Actor, id: string, data: { name?: string; email?: string }): Promise<UserResponseDTO> {
    // só admin ou o próprio user
    if (actor.role !== "ADMIN" && actor.userId !== id) throw new Error("FORBIDDEN");

    const updated = await this.userRepo.update(id, data);
    return UserEntity.toResponse(updated);
  }

  async delete(actor: Actor, id: string): Promise<void> {
    if (actor.userId === id) throw new Error("SELF_DELETE_FORBIDDEN");
    if (actor.role !== "ADMIN") throw new Error("FORBIDDEN");
    await this.userRepo.delete(id);
  }
}
