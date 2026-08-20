/**
 * maturity.model.ts
 *
 * Checklist de maturidade SIMPLIFICADO (decisão de 2026-08-03, ver
 * docs/BACKLOG.md): domínio → pergunta (MaturityControl) → resposta em
 * escala 1-5. SEM scoring ponderado, SEM nível por domínio, SEM comparativo
 * histórico — só média simples (calculada em maturity.service).
 *
 * MaturityDomain/MaturityControl são catálogo (seed, sem CRUD público — só
 * leitura via GET /maturity/catalog). MaturityAssessment/MaturityScore são
 * a avaliação em si, exclusiva de ADMIN (RN19).
 */

import type {
  MaturityDomain as PrismaMaturityDomain,
  MaturityControl as PrismaMaturityControl,
  MaturityAssessment as PrismaMaturityAssessment,
  MaturityScore as PrismaMaturityScore,
} from "@prisma/client";

export type MaturityDomain = PrismaMaturityDomain;
export type MaturityControl = PrismaMaturityControl;
export type MaturityAssessment = PrismaMaturityAssessment;
export type MaturityScore = PrismaMaturityScore;

export type MaturityLevel = "BASIC" | "INTERMEDIATE" | "ADVANCED";

// ---------- catálogo (leitura) ----------

export type MaturityControlResponseDTO = {
  id: string;
  domainId: string;
  name: string;
  description: string | null;
  sortOrder: number;
};

export type MaturityDomainResponseDTO = {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  controls: MaturityControlResponseDTO[];
};

export class MaturityCatalogEntity {
  static toResponse(
    domains: Array<MaturityDomain & { controls: MaturityControl[] }>,
  ): MaturityDomainResponseDTO[] {
    return domains.map((d) => ({
      id: d.id,
      name: d.name,
      description: d.description,
      sortOrder: d.sortOrder,
      controls: d.controls.map((c) => ({
        id: c.id,
        domainId: c.domainId,
        name: c.name,
        description: c.description,
        sortOrder: c.sortOrder,
      })),
    }));
  }
}

// ---------- assessment ----------

export type CreateAssessmentDTO = {
  companyId: string;
};

export type ScoreInputDTO = {
  controlId: string;
  score: number; // 1..5
  notes?: string;
};

export type MaturityScoreResponseDTO = {
  id: string;
  controlId: string;
  score: number;
  isCompliant: boolean;
  notes: string | null;
};

export type MaturityAssessmentResponseDTO = {
  id: string;
  companyId: string;
  overallScore: number;
  level: MaturityLevel;
  notes: string | null;
  evaluatedBy: string;
  createdAt: string;
  scores: MaturityScoreResponseDTO[];
};

export class MaturityAssessmentEntity {
  constructor(private readonly data: MaturityAssessment & { scores: MaturityScore[] }) {}

  toResponse(): MaturityAssessmentResponseDTO {
    return {
      id: this.data.id,
      companyId: this.data.companyId,
      overallScore: this.data.overallScore,
      level: this.data.level as MaturityLevel,
      notes: this.data.notes,
      evaluatedBy: this.data.evaluatedBy,
      createdAt: this.data.createdAt.toISOString(),
      scores: this.data.scores.map((s) => ({
        id: s.id,
        controlId: s.controlId,
        score: s.score,
        isCompliant: s.isCompliant,
        notes: s.notes,
      })),
    };
  }
}
