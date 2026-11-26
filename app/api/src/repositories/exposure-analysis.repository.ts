/**
 * exposure-analysis.repository.ts
 *
 * O QUE FAZ
 * As leituras das análises do Exposure Graph (ADR-061): combinações tóxicas,
 * raio de impacto e histórico. Separado de `exposure-graph.repository.ts`,
 * que é o grafo em si (cinco consultas fixas) e não deve crescer por análise.
 *
 * ISOLAMENTO
 * Toda tabela da company filtra por `companyId` — `Vulnerability`,
 * `CodeFinding`, `ThreatMatch`, `AuditLog`. `ThreatAdvisory` é dado público
 * (NVD/OSV/KEV), sem tenant, e só é lido pelos ids que as tabelas da company
 * apontaram. O service ainda descarta qualquer linha de aplicação que não
 * esteja na lista de ativas da company (segunda barreira).
 *
 * "ESTADO ATUAL" DO SCA
 * `CodeFinding` pertence a uma importação. O que vale hoje para um projeto é a
 * ÚLTIMA importação de cada ferramenta (`toolName`) — a mesma regra da
 * comparação novos/continuam/resolvidos do ADR-052. Falso positivo triado
 * fica de fora.
 *
 * QUEM USA
 * `exposure-analysis.service.ts`, exclusivamente.
 */

import { Prisma, type PrismaClient } from "@prisma/client";
import type { AmeacaDoAdvisory, OcorrenciaDeImpacto } from "../models/exposure-analysis.model";

const STATUS_ABERTOS = ["OPEN", "IN_PROGRESS"];

export interface AbertaComOrigem {
  id: string;
  title: string;
  severityFinal: string;
  owaspCategory: string;
  sourceType: string;
  vrsScore: number | null;
  createdAt: Date;
  applicationId: string;
  sourceCodeFindingId: string | null;
  sourceThreatMatchId: string | null;
}

export interface VulnerabilidadeParaHistorico {
  id: string;
  applicationId: string;
  title: string;
  owaspCategory: string;
  severityFinal: string;
  sourceType: string;
  status: string;
  createdAt: Date;
}

export interface MudancaDeStatusBruta {
  entityId: string;
  createdAt: Date;
  diffJson: string | null;
}

export interface ContagemDeOpcao {
  valor: string;
  aplicacoes: number;
}

/**
 * Subconsulta reutilizada: o `CodeFinding` `f` pertence à última importação da
 * sua ferramenta no seu projeto. Correlacionada por (projectId, toolName).
 */
const ULTIMA_IMPORTACAO = Prisma.sql`
  i.id = (
    SELECT i2.id FROM CodeScanImport i2
    WHERE i2.projectId = i.projectId AND i2.toolName = i.toolName
    ORDER BY i2.createdAt DESC, i2.id DESC
    LIMIT 1
  )`;

export class ExposureAnalysisRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /* ------------------------------------------------------------------
     Combinações tóxicas
     ------------------------------------------------------------------ */

  async listarAbertasComOrigem(companyId: string, applicationIds: string[]): Promise<AbertaComOrigem[]> {
    return this.prisma.vulnerability.findMany({
      where: { companyId, applicationId: { in: applicationIds }, status: { in: STATUS_ABERTOS } },
      select: {
        id: true,
        title: true,
        severityFinal: true,
        owaspCategory: true,
        sourceType: true,
        vrsScore: true,
        createdAt: true,
        applicationId: true,
        sourceCodeFindingId: true,
        sourceThreatMatchId: true,
      },
    });
  }

  /** O advisory (CVE/GHSA) de cada origem SCA e Threat Intel, dentro da company. */
  async advisoriesDasOrigens(
    companyId: string,
    codeFindingIds: string[],
    threatMatchIds: string[],
  ): Promise<{ porCodeFinding: Map<string, string>; porThreatMatch: Map<string, string> }> {
    const [codigo, casamentos] = await Promise.all([
      codeFindingIds.length
        ? this.prisma.codeFinding.findMany({
          where: { companyId, id: { in: codeFindingIds }, advisoryId: { not: null } },
          select: { id: true, advisoryId: true },
        })
        : Promise.resolve([]),
      threatMatchIds.length
        ? this.prisma.threatMatch.findMany({ where: { companyId, id: { in: threatMatchIds } }, select: { id: true, advisoryId: true } })
        : Promise.resolve([]),
    ]);
    return {
      porCodeFinding: new Map(codigo.map((c) => [c.id, c.advisoryId!.toUpperCase()])),
      porThreatMatch: new Map(casamentos.map((m) => [m.id, m.advisoryId.toUpperCase()])),
    };
  }

  /** KEV e EPSS dos advisories pedidos. Dado público: sem filtro de tenant. */
  async buscarAmeacas(advisoryIds: string[]): Promise<AmeacaDoAdvisory[]> {
    if (advisoryIds.length === 0) return [];
    return this.prisma.threatAdvisory.findMany({
      where: { id: { in: advisoryIds } },
      select: { id: true, kev: true, kevAddedAt: true, epssScore: true, epssPercentile: true },
    });
  }

  /* ------------------------------------------------------------------
     Raio de impacto
     ------------------------------------------------------------------ */

  async ocorrenciasDeCategoria(companyId: string, applicationIds: string[], categoria: string): Promise<OcorrenciaDeImpacto[]> {
    const linhas = await this.prisma.vulnerability.findMany({
      where: { companyId, applicationId: { in: applicationIds }, status: { in: STATUS_ABERTOS }, owaspCategory: categoria },
      select: { applicationId: true, severityFinal: true },
    });
    return linhas.map((l) => ({ applicationId: l.applicationId, severidade: l.severityFinal }));
  }

  /** O pacote no estado atual do SCA de cada projeto (última importação por ferramenta). */
  async ocorrenciasDePacote(companyId: string, pacote: string): Promise<OcorrenciaDeImpacto[]> {
    return this.prisma.$queryRaw<OcorrenciaDeImpacto[]>`
      SELECT p.applicationId AS applicationId, f.severity AS severidade, f.packageVersion AS versao
      FROM CodeFinding f
      JOIN CodeScanImport i ON i.id = f.importId
      JOIN Project p ON p.id = f.projectId
      WHERE f.companyId = ${companyId}
        AND f.category = 'SCA'
        AND f.packageName = ${pacote}
        AND f.triageStatus <> 'FALSE_POSITIVE'
        AND ${ULTIMA_IMPORTACAO}
    `;
  }

  /**
   * A CVE no estado atual do SCA e nas vulnerabilidades abertas promovidas do
   * Threat Intel. O casamento do Threat Intel NÃO promovido fica de fora: o
   * inventário é da company, não de uma aplicação (D9 — só relação comprovada).
   */
  async ocorrenciasDeCve(companyId: string, applicationIds: string[], cve: string): Promise<OcorrenciaDeImpacto[]> {
    const [doSca, doThreatIntel] = await Promise.all([
      this.prisma.$queryRaw<OcorrenciaDeImpacto[]>`
        SELECT p.applicationId AS applicationId, f.severity AS severidade, f.packageVersion AS versao, f.packageName AS pacote
        FROM CodeFinding f
        JOIN CodeScanImport i ON i.id = f.importId
        JOIN Project p ON p.id = f.projectId
        WHERE f.companyId = ${companyId}
          AND f.category = 'SCA'
          AND UPPER(f.advisoryId) = ${cve}
          AND f.triageStatus <> 'FALSE_POSITIVE'
          AND ${ULTIMA_IMPORTACAO}
      `,
      this.prisma.vulnerability.findMany({
        where: {
          companyId,
          applicationId: { in: applicationIds },
          status: { in: STATUS_ABERTOS },
          sourceThreatMatch: { advisoryId: cve, companyId },
        },
        select: { applicationId: true, severityFinal: true },
      }),
    ]);
    return [...doSca, ...doThreatIntel.map((v) => ({ applicationId: v.applicationId, severidade: v.severityFinal }))];
  }

  /** Pacotes do estado atual do SCA, por número de aplicações em que aparecem. */
  async opcoesDePacote(companyId: string, limite: number): Promise<ContagemDeOpcao[]> {
    const linhas = await this.prisma.$queryRaw<Array<{ valor: string; aplicacoes: bigint | number }>>`
      SELECT f.packageName AS valor, COUNT(DISTINCT p.applicationId) AS aplicacoes
      FROM CodeFinding f
      JOIN CodeScanImport i ON i.id = f.importId
      JOIN Project p ON p.id = f.projectId
      JOIN Application a ON a.id = p.applicationId AND a.isActive = true
      WHERE f.companyId = ${companyId}
        AND f.category = 'SCA'
        AND f.packageName IS NOT NULL
        AND f.triageStatus <> 'FALSE_POSITIVE'
        AND ${ULTIMA_IMPORTACAO}
      GROUP BY f.packageName
      ORDER BY aplicacoes DESC, valor ASC
      LIMIT ${limite}
    `;
    return linhas.map((l) => ({ valor: l.valor, aplicacoes: Number(l.aplicacoes) }));
  }

  /** CVEs do estado atual do SCA, por número de aplicações. */
  async opcoesDeCve(companyId: string, limite: number): Promise<ContagemDeOpcao[]> {
    const linhas = await this.prisma.$queryRaw<Array<{ valor: string; aplicacoes: bigint | number }>>`
      SELECT UPPER(f.advisoryId) AS valor, COUNT(DISTINCT p.applicationId) AS aplicacoes
      FROM CodeFinding f
      JOIN CodeScanImport i ON i.id = f.importId
      JOIN Project p ON p.id = f.projectId
      JOIN Application a ON a.id = p.applicationId AND a.isActive = true
      WHERE f.companyId = ${companyId}
        AND f.category = 'SCA'
        AND f.advisoryId IS NOT NULL
        AND f.triageStatus <> 'FALSE_POSITIVE'
        AND ${ULTIMA_IMPORTACAO}
      GROUP BY UPPER(f.advisoryId)
      ORDER BY aplicacoes DESC, valor ASC
      LIMIT ${limite}
    `;
    return linhas.map((l) => ({ valor: l.valor, aplicacoes: Number(l.aplicacoes) }));
  }

  /** Categorias OWASP com vulnerabilidade aberta, por número de aplicações. */
  async opcoesDeCategoria(companyId: string, applicationIds: string[]): Promise<ContagemDeOpcao[]> {
    const linhas = await this.prisma.vulnerability.groupBy({
      by: ["owaspCategory", "applicationId"],
      where: { companyId, applicationId: { in: applicationIds }, status: { in: STATUS_ABERTOS } },
    });
    const porCategoria = new Map<string, number>();
    for (const l of linhas) porCategoria.set(l.owaspCategory, (porCategoria.get(l.owaspCategory) ?? 0) + 1);
    return [...porCategoria.entries()]
      .map(([valor, aplicacoes]) => ({ valor, aplicacoes }))
      .sort((a, b) => b.aplicacoes - a.aplicacoes || a.valor.localeCompare(b.valor));
  }

  /* ------------------------------------------------------------------
     Histórico
     ------------------------------------------------------------------ */

  /** Todas as vulnerabilidades das aplicações ativas, em qualquer status (as fechadas contam o passado). */
  async listarParaHistorico(companyId: string, applicationIds: string[]): Promise<VulnerabilidadeParaHistorico[]> {
    return this.prisma.vulnerability.findMany({
      where: { companyId, applicationId: { in: applicationIds } },
      select: { id: true, applicationId: true, title: true, owaspCategory: true, severityFinal: true, sourceType: true, status: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
  }

  /**
   * STATUS_CHANGE de Vulnerability da company, em ordem cronológica. Filtrado
   * também pelos ids pedidos: uma linha de auditoria nunca traz vulnerabilidade
   * de fora da lista que o service já autorizou.
   */
  async listarMudancasDeStatus(companyId: string, vulnerabilityIds: string[]): Promise<MudancaDeStatusBruta[]> {
    if (vulnerabilityIds.length === 0) return [];
    return this.prisma.auditLog.findMany({
      where: { companyId, entityType: "Vulnerability", action: "STATUS_CHANGE", entityId: { in: vulnerabilityIds } },
      select: { entityId: true, createdAt: true, diffJson: true },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
  }
}
