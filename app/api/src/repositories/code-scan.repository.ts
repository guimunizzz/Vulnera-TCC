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

  // ==========================================================================
  // Pré-triagem: sinais de outras fontes (lidos, nunca escritos por aqui)
  // ==========================================================================

  /**
   * Advisories do Threat Intel para os ids dos achados SCA, chaveados pelo id
   * que o ACHADO usa. O id do relatório pode ser o CVE (Trivy) ou o GHSA (npm
   * audit, Grype): o que não casa pelo id é procurado nos aliases.
   * `noInventario`: a empresa tem a mesma advisory casada num ThreatMatch.
   */
  async findAdvisorySignals(
    companyId: string,
    advisoryIds: string[],
  ): Promise<Map<string, { id: string; kev: boolean; kevRansomware: boolean; epssScore: number | null; cvssVector: string | null; noInventario: boolean }>> {
    const ids = [...new Set(advisoryIds.map((i) => i.toUpperCase()))].slice(0, 1000);
    const out = new Map<string, { id: string; kev: boolean; kevRansomware: boolean; epssScore: number | null; cvssVector: string | null; noInventario: boolean }>();
    if (ids.length === 0) return out;

    const select = { id: true, aliases: true, kev: true, kevRansomware: true, epssScore: true, cvssVector: true } satisfies Prisma.ThreatAdvisorySelect;
    const diretos = await this.prisma.threatAdvisory.findMany({ where: { id: { in: ids } }, select });
    const achados = new Map<string, (typeof diretos)[number]>(diretos.map((a) => [a.id.toUpperCase(), a]));
    const faltam = ids.filter((i) => !achados.has(i)).slice(0, 200);
    if (faltam.length > 0) {
      const porAlias = await this.prisma.threatAdvisory.findMany({ where: { OR: faltam.map((i) => ({ aliases: { array_contains: [i] } })) }, select });
      for (const a of porAlias) {
        const aliases = Array.isArray(a.aliases) ? a.aliases.map((x) => String(x).toUpperCase()) : [];
        for (const i of faltam) if (aliases.includes(i) && !achados.has(i)) achados.set(i, a);
      }
    }

    const casadas = await this.prisma.threatMatch.findMany({
      where: { companyId, advisoryId: { in: [...new Set([...achados.values()].map((a) => a.id))] } },
      select: { advisoryId: true },
    });
    const noInventario = new Set(casadas.map((m) => m.advisoryId));
    for (const [pedido, a] of achados) {
      out.set(pedido, { id: a.id, kev: a.kev, kevRansomware: a.kevRansomware, epssScore: a.epssScore, cvssVector: a.cvssVector, noInventario: noInventario.has(a.id) });
    }
    return out;
  }

  /**
   * Vulnerabilities que o DAST confirmou na aplicação (promovidas por humano,
   * ADR-032), com o CWE do achado DAST de origem. Recorte por applicationId:
   * nada de outra aplicação — nem de outra empresa — entra no sinal.
   */
  async findDastConfirmedByApplication(applicationId: string): Promise<Array<{ vulnerabilityId: string; title: string; cweId: string }>> {
    const rows = await this.prisma.vulnerability.findMany({
      where: { applicationId, sourceType: "DAST_IMPORT", sourceDastFinding: { cweId: { not: null } } },
      select: { id: true, title: true, sourceDastFinding: { select: { cweId: true } } },
      orderBy: { createdAt: "desc" },
      take: 500,
    });
    return rows.flatMap((r) => (r.sourceDastFinding?.cweId ? [{ vulnerabilityId: r.id, title: r.title, cweId: r.sourceDastFinding.cweId }] : []));
  }

  /**
   * Grava a mesma triagem em vários achados de UMA importação, numa transação.
   * Só toca quem ainda está NEW: se alguém triou um deles entre a tela e o
   * clique, a decisão humana vence.
   */
  async triageMany(importId: string, groups: Array<{ ids: string[]; triageNote: string }>, input: { triageStatus: DastTriageStatus; triagedById: string; triagedAt: Date }): Promise<number> {
    const results = await this.prisma.$transaction(
      groups
        .filter((g) => g.ids.length > 0)
        .map((g) =>
          this.prisma.codeFinding.updateMany({
            where: { importId, id: { in: g.ids }, triageStatus: "NEW" },
            data: { ...input, triageNote: g.triageNote, triageInherited: false },
          }),
        ),
    );
    return results.reduce((n, r) => n + r.count, 0);
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
