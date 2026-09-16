/**
 * remediation-playbook.repository.ts
 *
 * Única camada que toca prisma.remediationPlaybook.* — sem lógica de negócio.
 *
 * 🎯 O RECORTE DE LEITURA É SEMPRE "SYSTEM + OS MEUS". Um tenant enxerga os
 * playbooks oficiais (globais) e os da PRÓPRIA empresa, nunca os de outra.
 * Isso vive aqui, no WHERE, e não numa checagem depois de buscar — buscar e
 * depois filtrar em memória é como vazamentos acontecem.
 */

import type { PrismaClient, Prisma } from "@prisma/client";
import type { RemediationPlaybook } from "../models/remediation-playbook.model";

export interface CreatePlaybookData {
  title: string;
  summary?: string | null;
  owaspCategory?: string | null;
  cweIds?: string | null;
  rootCause?: string | null;
  remediation?: string | null;
  validationSteps?: string | null;
  secureExample?: string | null;
  compensatingControls?: string | null;
  references?: string | null;
  source: string;
  sourceUrl?: string | null;
  sourceVersion?: string | null;
  sourceKey?: string | null;
  isSystem: boolean;
  companyId: string | null;
  clonedFromId?: string | null;
  createdBy?: string | null;
}

export type UpdatePlaybookData = Partial<Omit<CreatePlaybookData, "isSystem" | "companyId" | "source">>;

export interface ListPlaybooksFilter {
  /** null = ator sem empresa (ADMIN global): vê System + todos os customs. */
  companyId: string | null;
  /** ADMIN vê custom de qualquer empresa; os demais, só da sua. */
  todasAsEmpresas: boolean;
  owaspCategory?: string;
  search?: string;
  apenasSystem?: boolean;
  apenasCustom?: boolean;
}

export class RemediationPlaybookRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<RemediationPlaybook | null> {
    return this.prisma.remediationPlaybook.findUnique({ where: { id } });
  }

  /** O WHERE do recorte — System (global) + custom que o ator alcança. */
  private where(f: ListPlaybooksFilter): Prisma.RemediationPlaybookWhereInput {
    const alcance: Prisma.RemediationPlaybookWhereInput[] = [];
    if (!f.apenasCustom) alcance.push({ isSystem: true });
    if (!f.apenasSystem) {
      if (f.todasAsEmpresas) alcance.push({ isSystem: false });
      else if (f.companyId) alcance.push({ isSystem: false, companyId: f.companyId });
    }
    return {
      // alcance vazio (PENTESTER sem empresa pedindo apenasCustom) não pode
      // virar "sem filtro": seria o catálogo inteiro do produto.
      OR: alcance.length > 0 ? alcance : [{ id: "__NENHUM__" }],
      ...(f.owaspCategory ? { owaspCategory: f.owaspCategory } : {}),
      ...(f.search ? { title: { contains: f.search } } : {}),
    };
  }

  /**
   * Listagem: só metadados. O Markdown longo (até 20 KB por campo, seis
   * campos) fica no detalhe — uma listagem de 30 playbooks carregaria
   * megabytes de texto que ninguém lê ali.
   */
  async list(f: ListPlaybooksFilter): Promise<RemediationPlaybook[]> {
    return this.prisma.remediationPlaybook.findMany({
      where: this.where(f),
      // System primeiro na ordenação estável por categoria; o service reordena
      // colocando o custom do tenant na frente quando é sugestão de finding.
      orderBy: [{ owaspCategory: "asc" }, { isSystem: "desc" }, { title: "asc" }],
    });
  }

  /**
   * Playbooks de UMA categoria OWASP, para o bloco "Como corrigir" do finding.
   * Custom do tenant primeiro, System depois (D5).
   */
  async findByOwaspCategory(owaspCategory: string, companyId: string | null): Promise<RemediationPlaybook[]> {
    const alcance: Prisma.RemediationPlaybookWhereInput[] = [{ isSystem: true }];
    if (companyId) alcance.push({ isSystem: false, companyId });
    return this.prisma.remediationPlaybook.findMany({
      where: { owaspCategory, OR: alcance },
      orderBy: [{ isSystem: "asc" }, { updatedAt: "desc" }],
    });
  }

  async create(data: CreatePlaybookData): Promise<RemediationPlaybook> {
    return this.prisma.remediationPlaybook.create({ data });
  }

  async update(id: string, data: UpdatePlaybookData): Promise<RemediationPlaybook> {
    return this.prisma.remediationPlaybook.update({ where: { id }, data });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.remediationPlaybook.delete({ where: { id } });
  }

  /**
   * Upsert do sync (D5): idempotente por `[source, sourceKey]`.
   *
   * ⚠️ O WHERE do update carrega `isSystem: true` implicitamente — este
   * caminho só existe para linhas oficiais, e `sourceKey` nunca é preenchido
   * num custom. Um custom jamais é alcançado por aqui.
   */
  async upsertSystem(sourceKey: string, source: string, data: CreatePlaybookData): Promise<RemediationPlaybook> {
    return this.prisma.remediationPlaybook.upsert({
      where: { source_sourceKey: { source, sourceKey } },
      create: data,
      update: {
        title: data.title,
        summary: data.summary,
        owaspCategory: data.owaspCategory,
        cweIds: data.cweIds,
        rootCause: data.rootCause,
        remediation: data.remediation,
        validationSteps: data.validationSteps,
        secureExample: data.secureExample,
        references: data.references,
        sourceUrl: data.sourceUrl,
        sourceVersion: data.sourceVersion,
      },
    });
  }

  async countSystem(): Promise<number> {
    return this.prisma.remediationPlaybook.count({ where: { isSystem: true } });
  }
}
