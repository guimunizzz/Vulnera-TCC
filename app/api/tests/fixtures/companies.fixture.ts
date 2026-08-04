/**
 * companies.fixture.ts
 *
 * Helper para criar companies direto no banco de teste (bypass da API).
 * Não vincula usuário automaticamente — quem precisar de um dono, cria o
 * User via seedUser() já com companyId/companyRole.
 */

import { prisma } from "../../src/database/prisma.database";
import type { Company } from "@prisma/client";

export interface SeedCompanyInput {
  name: string;
  cnpj?: string | null;
  planId: string;
}

export async function seedCompany(input: SeedCompanyInput): Promise<Company> {
  return prisma.company.create({
    data: {
      name: input.name,
      cnpj: input.cnpj ?? null,
      planId: input.planId,
    },
  });
}
