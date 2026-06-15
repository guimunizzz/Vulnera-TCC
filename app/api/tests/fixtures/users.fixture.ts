/**
 * users.fixture.ts
 *
 * Helpers para criar usuários direto no banco de teste (bypass da API).
 * Usado pra montar cenários multi-role (ADMIN/CLIENT/PENTESTER) sem
 * depender do endpoint de registro, que sempre cria role=CLIENT.
 */

import { prisma } from "../../src/database/prisma.database";
import { hashPassword } from "../../src/utils/hash.util";
import type { UserRole } from "../../src/model/user.model";
import type { User } from "@prisma/client";

export interface SeedUserInput {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  companyId?: string | null;
}

export async function seedUser(input: SeedUserInput): Promise<User> {
  return prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      password: await hashPassword(input.password),
      role: input.role,
      companyId: input.companyId ?? null,
    },
  });
}
