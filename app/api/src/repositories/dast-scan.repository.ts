/**
 * dast-scan.repository.ts
 *
 * Única camada que toca `@prisma/client` pro recurso DastScan (CLAUDE.md
 * P1). Além do CRUD básico, concentra duas operações específicas do módulo:
 *
 *  - `createIfTargetFree`: sustenta a regra "1 scan por alvo de cada vez"
 *    com check e INSERT na mesma transação, protegidos por lock.
 *  - `persistFindingsAndUpdateCounters`: a ÚNICA escrita transacional do
 *    projeto até agora (`prisma.$transaction`) — insere os findings
 *    (`skipDuplicates: true`, defesa extra contra reprocessar o mesmo scan)
 *    e recalcula os contadores por risco a partir do que REALMENTE ficou
 *    gravado (`groupBy`), nunca do JSON bruto. Se o parsing tivesse falhado
 *    antes de chegar aqui, nada disso roda — não sobra scan com contador
 *    mentindo.
 */

import { Prisma } from "@prisma/client";
import type { PrismaClient, DastScan, DastScanStatus, DastSensorRun, DastSensorStatus, DastObservedAsset } from "@prisma/client";
import type { ObservedAsset } from "../services/sensors/sensor.types";
import type { CandidateFinding, RiskCounters } from "../services/dast-findings.service";

export interface CreateDastScanInput {
  targetUrl: string;
  requestedById: string;
  simulated?: boolean;
  /** ADR-056 — tenant já resolvido pelo service (companyId derivado da Application). */
  companyId?: string | null;
  applicationId?: string | null;
  projectId?: string | null;
  /** ADR-056 — origem do scan; agendado leva o id do agendamento. */
  trigger?: "MANUAL" | "SCHEDULED";
  scheduleId?: string | null;
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

/** Dados do INSERT de um scan; o status nasce QUEUED pelo default do schema. */
function dadosDoScan(input: CreateDastScanInput): Prisma.DastScanUncheckedCreateInput {
  return {
    targetUrl: input.targetUrl,
    requestedById: input.requestedById,
    simulated: input.simulated ?? false,
    companyId: input.companyId ?? null,
    applicationId: input.applicationId ?? null,
    projectId: input.projectId ?? null,
    trigger: input.trigger ?? "MANUAL",
    scheduleId: input.scheduleId ?? null,
  };
}

/** Deadlock do InnoDB (ou conflito de escrita do Prisma): a transação foi revertida e pode ser refeita. */
function ehDeadlock(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && (err.code === "P2034" || err.message.includes("Deadlock found"));
}

export class DastScanRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Cria o scan só se o alvo estiver livre (nenhum QUEUED/RUNNING). Devolve
   * null quando o alvo já está ocupado; quem chama traduz em 409 / TARGET_BUSY.
   *
   * Por que não é findFirst + create: duas requisições simultâneas liam "livre"
   * e criavam dois scans. Aqui a checagem é uma leitura com `FOR UPDATE` sobre o
   * índice (status, targetUrl), na mesma transação do INSERT. O lock cai na faixa
   * (QUEUED, alvo), onde o novo registro entra: o INSERT concorrente espera o
   * commit e depois enxerga o scan do vencedor. Isso depende de REPEATABLE READ
   * (READ COMMITTED não toma gap locks), por isso o isolamento é explícito.
   * Não precisa de migration: o índice composto já existe no schema.
   *
   * Duas transações concorrentes podem se travar (deadlock). O InnoDB reverte
   * uma delas; refazê-la a faz ver o scan da outra e responder "ocupado".
   */
  async createIfTargetFree(input: CreateDastScanInput): Promise<DastScan | null> {
    const tentativasMax = 3;
    for (let tentativa = 1; ; tentativa++) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            const ativos = await tx.$queryRaw<{ id: string }[]>`
              SELECT id FROM DastScan
              WHERE status IN ('QUEUED', 'RUNNING') AND targetUrl = ${input.targetUrl}
              FOR UPDATE`;
            if (ativos.length > 0) return null;
            return tx.dastScan.create({ data: dadosDoScan(input) });
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
        );
      } catch (err) {
        if (tentativa < tentativasMax && ehDeadlock(err)) continue;
        throw err;
      }
    }
  }

  async findById(id: string): Promise<DastScan | null> {
    return this.prisma.dastScan.findUnique({ where: { id } });
  }

  async findAll(): Promise<DastScan[]> {
    return this.prisma.dastScan.findMany({ orderBy: { createdAt: "desc" } });
  }

  /** O que o PENTESTER vê: os scans que pediu + os de agendamentos só por URL (de todo o time). */
  async findVisibleToPentester(userId: string): Promise<DastScan[]> {
    return this.prisma.dastScan.findMany({
      where: { OR: [{ requestedById: userId }, { trigger: "SCHEDULED", applicationId: null }] },
      orderBy: { createdAt: "desc" },
    });
  }

  async findByRequester(requestedById: string): Promise<DastScan[]> {
    return this.prisma.dastScan.findMany({ where: { requestedById }, orderBy: { createdAt: "desc" } });
  }

  /** Histórico de um agendamento: os scans dele, do mais recente para o mais antigo. */
  async findByScheduleId(scheduleId: string, take: number): Promise<DastScan[]> {
    return this.prisma.dastScan.findMany({ where: { scheduleId }, orderBy: { createdAt: "desc" }, take });
  }

  /** Base da comparação: o scan COMPLETED mais recente do agendamento anterior a `antesDe`. */
  async findCompletedBefore(scheduleId: string, antesDe: Date): Promise<DastScan | null> {
    return this.prisma.dastScan.findFirst({
      where: { scheduleId, status: "COMPLETED", createdAt: { lt: antesDe } },
      orderBy: { createdAt: "desc" },
    });
  }

  /** Todo scan ainda QUEUED/RUNNING — usado pelo watchdog de boot e por testes de órfão. */
  /**
   * ADR-056 — toma o scan para execução de forma ATÔMICA: só um chamador vê
   * `true`, e só se o scan ainda estiver QUEUED. É a guarda de idempotência
   * da fila (job repetido não roda duas vezes) e fecha a corrida com o
   * cancelamento (um CANCELLED nunca volta a RUNNING).
   */
  async claimQueued(id: string, data: UpdateDastScanInput): Promise<boolean> {
    const r = await this.prisma.dastScan.updateMany({ where: { id, status: "QUEUED" }, data: { ...data, status: "RUNNING" } });
    return r.count === 1;
  }

  /** ADR-056 — falha de fila (job perdido): só um scan ainda QUEUED vira FAILED. */
  async failIfQueued(id: string, errorMessage: string): Promise<boolean> {
    const r = await this.prisma.dastScan.updateMany({
      where: { id, status: "QUEUED" },
      data: { status: "FAILED", errorMessage, finishedAt: new Date(), phase: "FAILED", progress: 100 },
    });
    return r.count === 1;
  }

  async findByIds(ids: string[]): Promise<DastScan[]> {
    if (ids.length === 0) return [];
    return this.prisma.dastScan.findMany({ where: { id: { in: ids } } });
  }

  async findActiveOrQueued(): Promise<DastScan[]> {
    return this.prisma.dastScan.findMany({ where: { status: { in: ["QUEUED", "RUNNING"] } } });
  }

  async update(id: string, data: UpdateDastScanInput): Promise<DastScan> {
    return this.prisma.dastScan.update({ where: { id }, data });
  }

  /**
   * Grava só se o scan ainda está RUNNING, na mesma instrução do UPDATE. Gravação
   * tardia do runner (progresso, término) não pode reescrever um scan que o
   * usuário já cancelou (status e fase CANCELLED). Devolve false se nada foi gravado.
   */
  async updateIfRunning(id: string, data: UpdateDastScanInput): Promise<boolean> {
    const r = await this.prisma.dastScan.updateMany({ where: { id, status: "RUNNING" }, data });
    return r.count === 1;
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
