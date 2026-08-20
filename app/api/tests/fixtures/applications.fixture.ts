/**
 * applications.fixture.ts
 *
 * Helper para criar applications direto no banco de teste (bypass da API).
 */

import { prisma } from "../../src/database/prisma.database";
import type { Application } from "@prisma/client";

export interface SeedApplicationInput {
  name: string;
  companyId: string;
  url?: string | null;
  environment?: string;
  isActive?: boolean;
}

export async function seedApplication(input: SeedApplicationInput): Promise<Application> {
  return prisma.application.create({
    data: {
      name: input.name,
      companyId: input.companyId,
      url: input.url ?? null,
      environment: input.environment ?? "PROD",
      isActive: input.isActive ?? true,
    },
  });
}
