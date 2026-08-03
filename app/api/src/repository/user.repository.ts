/**
 * user.repository.ts
 *
 * Acesso ao DB para a entidade User. Sem lógica de negócio aqui — só CRUD.
 * PrismaClient injetado por construtor (DI manual via factory).
 */

import type { PrismaClient, User } from "@prisma/client";
import type { UserRole } from "../model/user.model";

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

  delete(id: string): Promise<User> {
    return this.prisma.user.delete({ where: { id } });
  }
}
