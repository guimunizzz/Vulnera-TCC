/**
 * report.repository.ts
 *
 * Única camada que toca prisma.report.* — só guarda o METADADO da geração
 * (quem, quando, tipo). O conteúdo do relatório (report-data) não passa por
 * aqui, é montado em report.service a partir de outros repositories.
 */

import type { PrismaClient } from "@prisma/client";
import type { Report } from "../models/report.model";

export interface CreateReportData {
  projectId: string;
  type: string;
  title: string;
  generatedBy: string;
}

export class ReportRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByProject(projectId: string): Promise<Report[]> {
    return this.prisma.report.findMany({ where: { projectId }, orderBy: { createdAt: "desc" } });
  }

  async create(data: CreateReportData): Promise<Report> {
    return this.prisma.report.create({ data });
  }
}
