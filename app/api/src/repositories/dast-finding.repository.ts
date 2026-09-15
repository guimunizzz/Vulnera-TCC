/**
 * dast-finding.repository.ts
 *
 * Leitura de DastFinding + a escrita de TRIAGEM. A escrita de importação
 * (insert em lote + contadores) continua em dast-scan.repository.ts
 * (persistFindingsAndUpdateCounters), porque é uma transação que também
 * atualiza o DastScan pai.
 *
 * ⚠️ A triagem mora aqui, e não lá, porque é uma edição de UM finding pelo
 * usuário — nada a ver com o pipeline de importação. Ver ADR-032.
 */

import type { PrismaClient, DastFinding, DastTriageStatus, Prisma } from "@prisma/client";

/** Finding + o mínimo do que ele virou, pra a UI não precisar de um segundo request por linha. */
export type DastFindingWithPromotion = DastFinding & {
  promotedVulnerability: { id: string; projectId: string; severityFinal: string; status: string } | null;
  triagedBy: { id: string; name: string } | null;
};

const PROMOTION_INCLUDE = {
  promotedVulnerability: { select: { id: true, projectId: true, severityFinal: true, status: true } },
  triagedBy: { select: { id: true, name: true } },
} satisfies Prisma.DastFindingInclude;

export interface UpdateTriageInput {
  triageStatus: DastTriageStatus;
  triageNote: string | null;
  triagedById: string;
  triagedAt: Date;
}

export class DastFindingRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByScanId(scanId: string): Promise<DastFindingWithPromotion[]> {
    return this.prisma.dastFinding.findMany({ where: { scanId }, include: PROMOTION_INCLUDE });
  }

  async findById(id: string): Promise<DastFindingWithPromotion | null> {
    return this.prisma.dastFinding.findUnique({ where: { id }, include: PROMOTION_INCLUDE });
  }

  async countByScanId(scanId: string): Promise<number> {
    return this.prisma.dastFinding.count({ where: { scanId } });
  }

  async updateTriage(id: string, input: UpdateTriageInput): Promise<DastFindingWithPromotion> {
    return this.prisma.dastFinding.update({ where: { id }, data: input, include: PROMOTION_INCLUDE });
  }

  /**
   * Só os fingerprints + risco de um scan — é o que a comparação entre duas
   * execuções precisa. Deliberadamente NÃO traz `evidence`/`description`
   * (campos TEXT): comparar dois scans grandes carregaria megabytes à toa
   * quando o diff só olha o fingerprint.
   */
  async findFingerprintsByScanId(scanId: string): Promise<Array<Pick<DastFinding, "id" | "fingerprint" | "title" | "risk" | "url" | "param">>> {
    return this.prisma.dastFinding.findMany({
      where: { scanId },
      select: { id: true, fingerprint: true, title: true, risk: true, url: true, param: true },
    });
  }
}
