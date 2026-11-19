/**
 * scan-schedule.repository.ts
 *
 * Persistência dos scans DAST agendados (ADR-056 §6). O MySQL é a fonte da
 * verdade: o worker reconcilia o Redis a partir daqui.
 */

import type { Prisma, PrismaClient, ScanSchedule, DastScanMode, ScanScheduleFrequency } from "@prisma/client";

/** Contexto que a página /agendamentos precisa ao lado de cada agendamento. */
const CONTEXTO = {
  application: {
    select: {
      id: true,
      name: true,
      url: true,
      isActive: true,
      dastAuthorizedAt: true,
      dastAuthorizedUntil: true,
      dastAuthorizedHost: true,
      company: { select: { name: true } },
    },
  },
  project: { select: { id: true, name: true } },
} satisfies Prisma.ScanScheduleInclude;

export type AgendamentoComContexto = Prisma.ScanScheduleGetPayload<{ include: typeof CONTEXTO }>;

/** Quem enxerga o quê (ADR-056 §7) — o service decide o escopo, o repositório só filtra. */
export type EscopoAgendamentos = { tudo: true } | { membroId: string } | { companyId: string };

export interface CreateScanScheduleInput {
  companyId: string;
  applicationId: string;
  projectId: string | null;
  mode: DastScanMode;
  frequency: ScanScheduleFrequency;
  hour: number;
  minute: number;
  dayOfWeek: number | null;
  timezone: string;
  enabled: boolean;
  createdById: string;
}

export type UpdateScanScheduleInput = Partial<Pick<ScanSchedule, "frequency" | "hour" | "minute" | "dayOfWeek" | "timezone" | "enabled">>;

export class ScanScheduleRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CreateScanScheduleInput): Promise<ScanSchedule> {
    return this.prisma.scanSchedule.create({ data });
  }

  async findById(id: string): Promise<ScanSchedule | null> {
    return this.prisma.scanSchedule.findUnique({ where: { id } });
  }

  async findByApplication(applicationId: string): Promise<ScanSchedule[]> {
    return this.prisma.scanSchedule.findMany({ where: { applicationId }, orderBy: { createdAt: "asc" } });
  }

  /** Página /agendamentos: os agendamentos do escopo, com aplicação, empresa e projeto. */
  async findVisiveis(escopo: EscopoAgendamentos): Promise<AgendamentoComContexto[]> {
    const where: Prisma.ScanScheduleWhereInput =
      "tudo" in escopo
        ? {}
        : "companyId" in escopo
          ? { companyId: escopo.companyId }
          : { application: { projects: { some: { members: { some: { userId: escopo.membroId } } } } } };
    return this.prisma.scanSchedule.findMany({ where, include: CONTEXTO, orderBy: [{ enabled: "desc" }, { createdAt: "asc" }] });
  }

  /** Todos os habilitados: o conjunto que o Redis precisa espelhar. */
  async findEnabled(): Promise<ScanSchedule[]> {
    return this.prisma.scanSchedule.findMany({ where: { enabled: true } });
  }

  async update(id: string, data: UpdateScanScheduleInput): Promise<ScanSchedule> {
    return this.prisma.scanSchedule.update({ where: { id }, data });
  }

  async registrarExecucao(id: string, data: { lastRunAt: Date; lastOutcome: string; lastScanId?: string | null }): Promise<void> {
    await this.prisma.scanSchedule.update({ where: { id }, data });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.scanSchedule.delete({ where: { id } });
  }
}
