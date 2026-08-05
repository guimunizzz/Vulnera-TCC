/**
 * vulnerabilities.fixture.ts
 *
 * Helper para criar vulnerabilities direto no banco de teste (bypass da
 * API) — útil pra testes que precisam de um finding já existente num
 * estado específico (status, severidade) sem depender do fluxo de create.
 */

import { prisma } from "../../src/database/prisma.database";
import type { Vulnerability } from "@prisma/client";

export interface SeedVulnerabilityInput {
  projectId: string;
  applicationId: string;
  companyId: string;
  createdBy: string;
  title?: string;
  description?: string;
  owaspCategory?: string;
  cvssVector?: string;
  cvssScore?: number;
  severityCalculated?: string;
  severityFinal?: string;
  status?: string;
}

export async function seedVulnerability(input: SeedVulnerabilityInput): Promise<Vulnerability> {
  const severityCalculated = input.severityCalculated ?? "CRITICAL";
  return prisma.vulnerability.create({
    data: {
      projectId: input.projectId,
      applicationId: input.applicationId,
      companyId: input.companyId,
      createdBy: input.createdBy,
      title: input.title ?? "SQL Injection em /login",
      description: input.description ?? "Parâmetro 'user' não sanitizado permite injeção SQL.",
      owaspCategory: input.owaspCategory ?? "A03",
      cvssVector: input.cvssVector ?? "AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
      cvssScore: input.cvssScore ?? 9.8,
      severityCalculated,
      severityFinal: input.severityFinal ?? severityCalculated,
      status: input.status ?? "OPEN",
    },
  });
}
