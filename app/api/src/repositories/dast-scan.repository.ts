/**
 * dast-scan.repository.ts
 *
 * Única camada que toca `@prisma/client` pro recurso DastScan (CLAUDE.md
 * P1). Além do CRUD básico, concentra duas operações específicas do módulo:
 *
 *  - `findActiveForTarget`: sustenta a regra "1 scan por alvo de cada vez"
 *    (o service consulta antes de criar).
 *  - `persistFindingsAndUpdateCounters`: a ÚNICA escrita transacional do
 *    projeto até agora (`prisma.$transaction`) — insere os findings
 *    (`skipDuplicates: true`, defesa extra contra reprocessar o mesmo scan)
 *    e recalcula os contadores por risco a partir do que REALMENTE ficou
 *    gravado (`groupBy`), nunca do JSON bruto. Se o parsing tivesse falhado
 *    antes de chegar aqui, nada disso roda — não sobra scan com contador
 *    mentindo.
 */

import type { PrismaClient, Prisma, DastScan, DastScanStatus, DastSensorRun, DastSensorStatus, DastObservedAsset } from "@prisma/client";
import type { ObservedAsset } from "../services/sensors/sensor.types";
import type { CandidateFinding, RiskCounters } from "../services/dast-findings.service";

export interface CreateDastScanInput {
  targetUrl: string;
  requestedById: string;
  simulated?: boolean;
}

export interface UpdateDastScanInput {
  status?: DastScanStatus;
  containerName?: string | null;
  startedAt?: Date;
  finishedAt?: Date;
  durationMs?: number;
  errorMessage?: string | null;
  htmlReportPath?: string | null;
  jsonReportPath?: string | null;
  progress?: number;
  phase?: string | null;
  simulated?: boolean;
  warningMessage?: string | null;
}

export interface SaveSensorRunInput {
  sensorKey: string;
  status: DastSensorStatus;
  message: string | null;
  startedAt: Date;
  finishedAt: Date;
  durationMs: number;
}

export class DastScanRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateDastScanInput): Promise<DastScan> {
    return this.prisma.dastScan.create({
      data: {
        targetUrl: input.targetUrl,
        requestedById: input.requestedById,
        simulated: input.simulated ?? false,
      },
    });
  }

  async findById(id: string): Promise<DastScan | null> {
    return this.prisma.dastScan.findUnique({ where: { id } });
  }

  async findAll(): Promise<DastScan[]> {
    return this.prisma.dastScan.findMany({ orderBy: { createdAt: "desc" } });
  }

  async findByRequester(requestedById: string): Promise<DastScan[]> {
    return this.prisma.dastScan.findMany({ where: { requestedById }, orderBy: { createdAt: "desc" } });
  }

  /** Sustenta a regra "1 scan por alvo de cada vez" — consultado ANTES de criar. */
  async findActiveForTarget(targetUrl: string): Promise<DastScan | null> {
    return this.prisma.dastScan.findFirst({
      where: { targetUrl, status: { in: ["QUEUED", "RUNNING"] } },
    });
  }

  /** Todo scan ainda QUEUED/RUNNING — usado pelo watchdog de boot e por testes de órfão. */
  async findActiveOrQueued(): Promise<DastScan[]> {
    return this.prisma.dastScan.findMany({ where: { status: { in: ["QUEUED", "RUNNING"] } } });
  }

  async update(id: string, data: UpdateDastScanInput): Promise<DastScan> {
    return this.prisma.dastScan.update({ where: { id }, data });
  }

  /**
   * Insere os findings e atualiza os 4 contadores de risco NA MESMA
   * transação. `skipDuplicates` cobre reprocessar o mesmo scanId (o pipeline
   * em dast-findings.service.ts já deduplica por fingerprint antes de
   * chegar aqui — isso é a segunda camada, não a primeira).
   */
  async persistFindingsAndUpdateCounters(scanId: string, findings: CandidateFinding[]): Promise<RiskCounters> {
    return this.prisma.$transaction(async (tx) => {
      if (findings.length > 0) {
        await tx.dastFinding.createMany({
          data: findings.map((f) => ({ ...f, scanId })),
          skipDuplicates: true,
        });
      }

      const grouped = await tx.dastFinding.groupBy({
        by: ["risk"],
        where: { scanId },
        _count: { _all: true },
      });

      const counters: RiskCounters = { alertsHigh: 0, alertsMedium: 0, alertsLow: 0, alertsInfo: 0 };
      for (const group of grouped) {
        if (group.risk === "HIGH") counters.alertsHigh = group._count._all;
        else if (group.risk === "MEDIUM") counters.alertsMedium = group._count._all;
        else if (group.risk === "LOW") counters.alertsLow = group._count._all;
        else if (group.risk === "INFO") counters.alertsInfo = group._count._all;
      }

      await tx.dastScan.update({ where: { id: scanId }, data: counters });
      return counters;
    });
  }

  /** Upsert por (scan, sensor): reprocessar o mesmo scan substitui o registro, não duplica. */
  async saveSensorRun(scanId: string, run: SaveSensorRunInput): Promise<DastSensorRun> {
    return this.prisma.dastSensorRun.upsert({
      where: { scanId_sensorKey: { scanId, sensorKey: run.sensorKey } },
      create: { scanId, ...run },
      update: run,
    });
  }

  /** Ativos são topologia do scan: o mesmo (tipo, valor) visto por dois sensores fica com o primeiro. */
  async saveAssets(scanId: string, sensorKey: string, assets: ObservedAsset[]): Promise<void> {
    if (assets.length === 0) return;
    await this.prisma.dastObservedAsset.createMany({
      data: assets.map((a) => ({
        scanId,
        sensorKey,
        kind: a.kind,
        value: a.value.slice(0, 255),
        parentValue: a.parentValue?.slice(0, 255) ?? null,
        metadata: (a.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      })),
      skipDuplicates: true,
    });
  }

  async findAssets(scanId: string): Promise<DastObservedAsset[]> {
    return this.prisma.dastObservedAsset.findMany({ where: { scanId }, orderBy: [{ kind: "asc" }, { value: "asc" }] });
  }

  async findSensorRuns(scanId: string): Promise<DastSensorRun[]> {
    return this.prisma.dastSensorRun.findMany({ where: { scanId }, orderBy: { startedAt: "asc" } });
  }
}
