/**
 * applications.fixture.ts
 *
 * Helper para criar applications direto no banco de teste (bypass da API).
 * Desde o CP-1 aceita o contexto de risco — ausente, valem os defaults do
 * schema (MEDIUM / false / INTERNAL), exatamente como uma app criada antes
 * da migration.
 */

import { prisma } from "../../src/database/prisma.database";
import type { Application } from "@prisma/client";

export interface SeedApplicationInput {
  name: string;
  companyId: string;
  url?: string | null;
  environment?: string;
  isActive?: boolean;
  criticality?: string;
  internetFacing?: boolean;
  dataSensitivity?: string;
  businessOwner?: string | null;
  technicalOwner?: string | null;
}

export async function seedApplication(input: SeedApplicationInput): Promise<Application> {
  return prisma.application.create({
    data: {
      name: input.name,
      companyId: input.companyId,
      url: input.url ?? null,
      environment: input.environment ?? "PROD",
      isActive: input.isActive ?? true,
      ...(input.criticality !== undefined ? { criticality: input.criticality } : {}),
      ...(input.internetFacing !== undefined ? { internetFacing: input.internetFacing } : {}),
      ...(input.dataSensitivity !== undefined ? { dataSensitivity: input.dataSensitivity } : {}),
      ...(input.businessOwner !== undefined ? { businessOwner: input.businessOwner } : {}),
      ...(input.technicalOwner !== undefined ? { technicalOwner: input.technicalOwner } : {}),
    },
  });
}
