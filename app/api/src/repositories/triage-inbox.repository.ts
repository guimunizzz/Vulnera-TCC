/**
 * triage-inbox.repository.ts
 *
 * O QUE FAZ
 * As duas leituras que a caixa de triagem (ADR-062) faz direto no banco: os
 * achados NEW do DAST e do SAST/SCA. Recebe SÓ ids que o service já obteve
 * dos serviços de cada fonte (scans e importações visíveis ao ator) — nenhuma
 * consulta aqui decide acesso, e nenhuma roda sem lista de ids.
 *
 * Threat Intel não passa por aqui: a listagem dele já existe no service da
 * fonte, com o escopo e a permissão de triar.
 *
 * QUEM USA
 * `triage-inbox.service.ts`, exclusivamente.
 */

import type { PrismaClient } from "@prisma/client";

export interface DastNovoBruto {
  id: string;
  title: string;
  risk: string;
  url: string;
  param: string | null;
  description: string | null;
  createdAt: Date;
  scanId: string;
  scan: { targetUrl: string };
}

export interface CodigoNovoBruto {
  id: string;
  title: string;
  severity: string;
  category: string;
  ruleId: string;
  filePath: string | null;
  startLine: number | null;
  packageName: string | null;
  packageVersion: string | null;
  advisoryId: string | null;
  description: string | null;
  createdAt: Date;
  importId: string;
}

export class TriageInboxRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async dastNovos(scanIds: string[], limite: number): Promise<DastNovoBruto[]> {
    if (scanIds.length === 0) return [];
    return this.prisma.dastFinding.findMany({
      where: { scanId: { in: scanIds }, triageStatus: "NEW" },
      select: { id: true, title: true, risk: true, url: true, param: true, description: true, createdAt: true, scanId: true, scan: { select: { targetUrl: true } } },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      take: limite,
    });
  }

  async codigoNovos(importIds: string[], limite: number): Promise<CodigoNovoBruto[]> {
    if (importIds.length === 0) return [];
    return this.prisma.codeFinding.findMany({
      where: { importId: { in: importIds }, triageStatus: "NEW" },
      select: {
        id: true,
        title: true,
        severity: true,
        category: true,
        ruleId: true,
        filePath: true,
        startLine: true,
        packageName: true,
        packageVersion: true,
        advisoryId: true,
        description: true,
        createdAt: true,
        importId: true,
      },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      take: limite,
    });
  }
}
