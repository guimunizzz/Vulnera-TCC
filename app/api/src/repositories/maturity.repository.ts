/**
 * maturity.repository.ts
 *
 * Única camada que toca prisma.maturity*.* — sem lógica de negócio (média,
 * nível derivado etc. ficam em maturity.service).
 */

import type { PrismaClient } from "@prisma/client";
import type { MaturityAssessment, MaturityControl, MaturityDomain, MaturityScore } from "../models/maturity.model";

type AssessmentWithScores = MaturityAssessment & { scores: MaturityScore[] };
type DomainWithControls = MaturityDomain & { controls: MaturityControl[] };
export type ScoreWithDomain = MaturityScore & { control: MaturityControl & { domain: MaturityDomain } };
type AssessmentWithDomains = MaturityAssessment & { scores: ScoreWithDomain[] };

export class MaturityRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findCatalog(): Promise<DomainWithControls[]> {
    return this.prisma.maturityDomain.findMany({
      orderBy: { sortOrder: "asc" },
      include: { controls: { orderBy: { sortOrder: "asc" } } },
    });
  }

  async findControlById(id: string): Promise<MaturityControl | null> {
    return this.prisma.maturityControl.findUnique({ where: { id } });
  }

  async createAssessment(companyId: string, evaluatedBy: string): Promise<MaturityAssessment> {
    return this.prisma.maturityAssessment.create({ data: { companyId, evaluatedBy } });
  }

  async findAssessmentById(id: string): Promise<AssessmentWithScores | null> {
    return this.prisma.maturityAssessment.findUnique({ where: { id }, include: { scores: true } });
  }

  async findLatestByCompany(companyId: string): Promise<AssessmentWithScores | null> {
    return this.prisma.maturityAssessment.findFirst({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      include: { scores: true },
    });
  }

  /** Usado pelo relatório executivo (Fase 8) — precisa saber o DOMÍNIO de cada score pra calcular a média por domínio. */
  async findLatestByCompanyWithDomains(companyId: string): Promise<AssessmentWithDomains | null> {
    return this.prisma.maturityAssessment.findFirst({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      include: { scores: { include: { control: { include: { domain: true } } } } },
    });
  }

  async upsertScore(
    assessmentId: string,
    controlId: string,
    score: number,
    isCompliant: boolean,
    notes?: string,
  ): Promise<MaturityScore> {
    return this.prisma.maturityScore.upsert({
      where: { assessmentId_controlId: { assessmentId, controlId } },
      update: { score, isCompliant, notes },
      create: { assessmentId, controlId, score, isCompliant, notes },
    });
  }

  async updateAssessmentAverage(id: string, overallScore: number, level: string): Promise<MaturityAssessment> {
    return this.prisma.maturityAssessment.update({ where: { id }, data: { overallScore, level } });
  }
}
