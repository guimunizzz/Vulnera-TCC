/**
 * plans.fixture.ts
 *
 * Helper para criar planos direto no banco de teste (bypass da API).
 */

import { prisma } from "../../src/database/prisma.database";
import type { Plan } from "@prisma/client";

export interface SeedPlanInput {
  name: string;
  maxApplications?: number;
  maxProjects?: number;
  includesRemediation?: boolean;
  price?: number;
  isActive?: boolean;
}

export async function seedPlan(input: SeedPlanInput): Promise<Plan> {
  return prisma.plan.create({
    data: {
      name: input.name,
      maxApplications: input.maxApplications ?? 5,
      maxProjects: input.maxProjects ?? 3,
      includesRemediation: input.includesRemediation ?? false,
      price: input.price ?? 100,
      isActive: input.isActive ?? true,
    },
  });
}
