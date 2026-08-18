// Tipos espelham os DTOs do backend (app/api/src/models/maturity.model.ts).
//
// Checklist SIMPLIFICADO (decisão de 2026-08-03): domínio → pergunta →
// resposta 1-5. SEM scoring ponderado, SEM nível por domínio, SEM
// comparativo histórico — só média simples.

export type MaturityLevel = "BASIC" | "INTERMEDIATE" | "ADVANCED";

export const MATURITY_LEVEL_LABELS: Record<MaturityLevel, string> = {
  BASIC: "Básico",
  INTERMEDIATE: "Intermediário",
  ADVANCED: "Avançado",
};

export interface MaturityControl {
  id: string;
  domainId: string;
  name: string;
  description: string | null;
  sortOrder: number;
}

export interface MaturityDomain {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  controls: MaturityControl[];
}

export interface MaturityScore {
  id: string;
  controlId: string;
  score: number; // 1..5
  isCompliant: boolean;
  notes: string | null;
}

export interface MaturityAssessment {
  id: string;
  companyId: string;
  overallScore: number;
  level: MaturityLevel;
  notes: string | null;
  evaluatedBy: string;
  createdAt: string;
  scores: MaturityScore[];
}

export interface ScoreInput {
  controlId: string;
  score: number; // 1..5
  notes?: string;
}
