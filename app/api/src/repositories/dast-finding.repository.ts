/**
 * dast-finding.repository.ts
 *
 * Leitura de DastFinding — a escrita (insert em lote + contadores) vive em
 * dast-scan.repository.ts (persistFindingsAndUpdateCounters), porque é uma
 * transação que também atualiza o DastScan pai. Este repository é só
 * consulta, usado por GET /scans/:id/findings e pelo endpoint /report/data.
 */

import type { PrismaClient, DastFinding } from "@prisma/client";

export class DastFindingRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByScanId(scanId: string): Promise<DastFinding[]> {
    return this.prisma.dastFinding.findMany({ where: { scanId } });
  }

  async countByScanId(scanId: string): Promise<number> {
    return this.prisma.dastFinding.count({ where: { scanId } });
  }
}
