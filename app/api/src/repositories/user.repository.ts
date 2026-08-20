/**
 * user.repository.ts
 *
 * Acesso ao DB para a entidade User. Sem lógica de negócio aqui — só CRUD.
 * PrismaClient injetado por construtor (DI manual via factory).
 */

import type { PrismaClient, User } from "@prisma/client";
import type { UserRole } from "../models/user.model";

export interface CreateUserData {
  name: string;
  email: string;
  password: string;
  role?: UserRole;
  companyId?: string | null;
}

export class UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findAll(filters: { companyId?: string } = {}): Promise<User[]> {
    return this.prisma.user.findMany({
      where: filters.companyId ? { companyId: filters.companyId } : {},
      orderBy: { createdAt: "desc" },
    });
  }

  /** Resolução em lote (ex: nomes de autor/responsável no report-data) — evita N+1 chamada a chamada. */
  findByIds(ids: string[]): Promise<User[]> {
    if (ids.length === 0) return Promise.resolve([]);
    return this.prisma.user.findMany({ where: { id: { in: ids } } });
  }

  create(data: CreateUserData): Promise<User> {
    return this.prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: data.password,
        role: data.role ?? "CLIENT",
        companyId: data.companyId ?? null,
      },
    });
  }

  update(id: string, data: Partial<{ name: string; email: string }>): Promise<User> {
    return this.prisma.user.update({ where: { id }, data });
  }

  /** Fase 7 (push) — token do Expo Push Service capturado pelo app mobile no login. */
  updateExpoPushToken(id: string, expoPushToken: string): Promise<User> {
    return this.prisma.user.update({ where: { id }, data: { expoPushToken } });
  }

  /** Usado pelo disparo de push (RN20-like em CRITICAL): só quem tem token registrado. */
  findClientsWithPushToken(companyId: string): Promise<User[]> {
    return this.prisma.user.findMany({
      where: { companyId, role: "CLIENT", expoPushToken: { not: null } },
    });
  }

  /** Vincula o usuário a uma company recém-criada, tornando-o dono dela. */
  setCompanyOwnership(userId: string, companyId: string, companyRole: string): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { companyId, companyRole },
    });
  }

  delete(id: string): Promise<User> {
    return this.prisma.user.delete({ where: { id } });
  }
}
