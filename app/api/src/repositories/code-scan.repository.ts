/**
 * code-scan.repository.ts
 *
 * Persistência das importações SAST/SCA (ADR-052): `CodeScanImport` e seus
 * `CodeFinding`. Único ponto do módulo que fala com o Prisma.
 *
 * A importação é gravada numa TRANSAÇÃO (cabeçalho + achados): uma importação
 * pela metade mostraria contadores que não batem com a lista, e a próxima
 * reimportação compararia contra uma base incompleta.
 */

import type { CodeFinding, CodeScanImport, DastTriageStatus, Prisma, PrismaClient } from "@prisma/client";

const FINDING_INCLUDE = {
  promotedVulnerability: { select: { id: true, projectId: true, severityFinal: true, status: true } },
  triagedBy: { select: { id: true, name: true } },
} satisfies Prisma.CodeFindingInclude;

export type CodeFindingWithRelations = CodeFinding & {
  promotedVulnerability: { id: string; projectId: string; severityFinal: string; status: string } | null;
  triagedBy: { id: string; name: string } | null;
};

const IMPORT_INCLUDE = {
  uploadedBy: { select: { id: true, name: true } },
  project: { select: { id: true, name: true, application: { select: { name: true } }, company: { select: { name: true } } } },
} satisfies Prisma.CodeScanImportInclude;

export type CodeScanImportWithUploader = CodeScanImport & {
  uploadedBy: { id: string; name: string };
  project: { id: string; name: string; application: { name: string }; company: { name: string } };
};

export type CreateCodeImportData = Omit<Prisma.CodeScanImportUncheckedCreateInput, "id" | "findings" | "createdAt">;
export type CreateCodeFindingData = Omit<Prisma.CodeFindingCreateManyInput, "id" | "importId" | "createdAt">;

export interface UpdateCodeTriageInput {
  triageStatus: DastTriageStatus;
  triageNote: string | null;
  triagedById: string;
  triagedAt: Date;
}

/** O mínimo de um achado que a comparação e a herança de triagem precisam (sem os campos TEXT). */
export type CodeFindingSummary = Pick<
  CodeFinding,
  "id" | "fingerprint" | "title" | "severity" | "category" | "filePath" | "startLine" | "packageName" | "packageVersion" | "triageStatus" | "triageNote" | "triagedById" | "triagedAt"
>;

const SUMMARY_SELECT = {
  id: true,
  fingerprint: true,
  title: true,
  severity: true,
  category: true,
  filePath: true,
  startLine: true,
  packageName: true,
  packageVersion: true,
  triageStatus: true,
  triageNote: true,
  triagedById: true,
  triagedAt: true,
} satisfies Prisma.CodeFindingSelect;

export class CodeScanRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createImportWithFindings(data: CreateCodeImportData, findings: CreateCodeFindingData[]): Promise<CodeScanImportWithUploader> {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.codeScanImport.create({ data });
      if (findings.length > 0) {
        await tx.codeFinding.createMany({ data: findings.map((f) => ({ ...f, importId: created.id })) });
      }
      return tx.codeScanImport.findUniqueOrThrow({ where: { id: created.id }, include: IMPORT_INCLUDE });
    });
  }

  /** Importação mais recente do mesmo projeto, formato e ferramenta — a base da comparação. */
  async findLatestComparable(projectId: string, format: string, toolName: string): Promise<CodeScanImport | null> {
    return this.prisma.codeScanImport.findFirst({
      where: { projectId, format, toolName },
      orderBy: { createdAt: "desc" },
    });
  }

  async findImportById(id: string): Promise<CodeScanImportWithUploader | null> {
    return this.prisma.codeScanImport.findUnique({ where: { id }, include: IMPORT_INCLUDE });
  }

  /**
   * Importações de TODOS os projetos que o ator enxerga: ADMIN, todas; os
   * demais, só as dos projetos de que são membros. O filtro de membro é feito
   * no banco — buscar tudo e filtrar em memória vazaria por paginação/contagem.
   */
  async listImportsVisibleTo(userId: string, isAdmin: boolean, take = 200): Promise<CodeScanImportWithUploader[]> {
    return this.prisma.codeScanImport.findMany({
      where: isAdmin ? {} : { project: { members: { some: { userId } } } },
      include: IMPORT_INCLUDE,
      orderBy: { createdAt: "desc" },
      take,
    });
  }

  async listImportsByProject(projectId: string): Promise<CodeScanImportWithUploader[]> {
    return this.prisma.codeScanImport.findMany({ where: { projectId }, include: IMPORT_INCLUDE, orderBy: { createdAt: "desc" } });
  }

  async listFindingsByImport(importId: string): Promise<CodeFindingWithRelations[]> {
    return this.prisma.codeFinding.findMany({ where: { importId }, include: FINDING_INCLUDE });
  }

  async findFindingById(id: string): Promise<CodeFindingWithRelations | null> {
    return this.prisma.codeFinding.findUnique({ where: { id }, include: FINDING_INCLUDE });
  }

  async updateTriage(id: string, input: UpdateCodeTriageInput): Promise<CodeFindingWithRelations> {
    return this.prisma.codeFinding.update({
      where: { id },
      data: { ...input, triageInherited: false },
      include: FINDING_INCLUDE,
    });
  }

  /** Contagem por (importação, severidade) num GROUP BY só — alimenta as listas sem carregar achados. */
  async countSeverities(importIds: string[]): Promise<Array<{ importId: string; severity: string; count: number }>> {
    if (importIds.length === 0) return [];
    const rows = await this.prisma.codeFinding.groupBy({
      by: ["importId", "severity"],
      where: { importId: { in: importIds } },
      _count: { _all: true },
    });
    return rows.map((r) => ({ importId: r.importId, severity: r.severity, count: r._count._all }));
  }

  async findSummariesByImport(importId: string): Promise<CodeFindingSummary[]> {
    return this.prisma.codeFinding.findMany({ where: { importId }, select: SUMMARY_SELECT });
  }

  /**
   * Vulnerabilities já promovidas, no projeto, a partir de QUALQUER importação
   * com um destes fingerprints. É o que faz a dedup valer entre importações:
   * o mesmo achado reimportado amanhã não vira uma segunda Vulnerability.
   */
  async findPromotionsByFingerprints(
    projectId: string,
    fingerprints: string[],
  ): Promise<Array<{ fingerprint: string; vulnerability: { id: string; projectId: string; severityFinal: string; status: string } }>> {
    if (fingerprints.length === 0) return [];
    const rows = await this.prisma.codeFinding.findMany({
      where: { projectId, fingerprint: { in: fingerprints }, promotedVulnerability: { isNot: null } },
      select: { fingerprint: true, promotedVulnerability: { select: { id: true, projectId: true, severityFinal: true, status: true } } },
    });
    return rows.flatMap((r) => (r.promotedVulnerability ? [{ fingerprint: r.fingerprint, vulnerability: r.promotedVulnerability }] : []));
  }
}
