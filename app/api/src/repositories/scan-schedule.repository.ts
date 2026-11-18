/**
 * scan-schedule.repository.ts
 *
 * Persistência dos scans DAST agendados (ADR-056 §6). O MySQL é a fonte da
 * verdade: o worker reconcilia o Redis a partir daqui.
 */

import type { PrismaClient, ScanSchedule, DastScanMode, ScanScheduleFrequency } from "@prisma/client";

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
