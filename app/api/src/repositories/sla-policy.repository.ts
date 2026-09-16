/**
 * sla-policy.repository.ts
 *
 * Única camada que toca prisma.slaPolicy.* — sem lógica de negócio.
 *
 * "Uma ativa por company" é imposta no service (o MySQL não faz unique
 * parcial); aqui só existem as operações que o service compõe: achar a
 * ativa, achar a padrão, criar, desativar. Não há update de prazos de
 * propósito — política se versiona, não se edita (ver sla-policy.model.ts).
 */

import type { PrismaClient } from "@prisma/client";
import type { SlaPolicy } from "../models/sla-policy.model";

export interface CreateSlaPolicyData {
  companyId: string | null;
  name: string;
  criticalDays: number;
  highDays: number;
  mediumDays: number;
  lowDays: number;
  createdBy: string;
}

export class SlaPolicyRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<SlaPolicy | null> {
    return this.prisma.slaPolicy.findUnique({ where: { id } });
  }

  /** A política ativa da empresa, ou null se ela nunca configurou a sua. */
  async findActiveByCompany(companyId: string): Promise<SlaPolicy | null> {
    return this.prisma.slaPolicy.findFirst({
      where: { companyId, isActive: true },
      orderBy: { createdAt: "desc" },
    });
  }

  /** A política padrão do produto (companyId = null). Pode não existir num banco sem seed. */
  async findDefault(): Promise<SlaPolicy | null> {
    return this.prisma.slaPolicy.findFirst({
      where: { companyId: null, isActive: true },
      orderBy: { createdAt: "desc" },
    });
  }

  /** Histórico completo da empresa, da mais recente para a mais antiga. */
  async findAllByCompany(companyId: string): Promise<SlaPolicy[]> {
    return this.prisma.slaPolicy.findMany({ where: { companyId }, orderBy: { createdAt: "desc" } });
  }

  async create(data: CreateSlaPolicyData): Promise<SlaPolicy> {
    return this.prisma.slaPolicy.create({ data });
  }

  /** Desativa TODAS as ativas do recorte — é o passo anterior a criar a nova versão. */
  async deactivateAll(companyId: string | null): Promise<number> {
    const r = await this.prisma.slaPolicy.updateMany({
      where: { companyId, isActive: true },
      data: { isActive: false },
    });
    return r.count;
  }
}
