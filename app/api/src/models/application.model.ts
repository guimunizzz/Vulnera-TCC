/**
 * application.model.ts
 *
 * Tipos do domínio Application — o alvo que é analisado.
 *
 * Desde o CP-1 da iniciativa Exposure & Remediation (2026-09-15) a Application
 * carrega CONTEXTO DE RISCO: cinco fatos sobre o alvo que o CVSS não sabe
 * (criticidade, ambiente, exposição à internet, sensibilidade do dado, donos).
 * O CVSS mede a falha; isto mede onde ela está. É o que alimenta o VRS (CP-3)
 * e as Cadeias de Exposição (CP-8).
 *
 * 🎯 As ORDENS dos valores (`CRITICALITY_RANK` etc.) não são enfeite: são o
 * que decide se uma mudança de contexto AUMENTA ou REDUZ risco — e quem pode
 * fazer cada uma (docs/DECISIONS.md D2). Subir é permitido a CLIENT OWNER;
 * descer exige ADMIN. Sem rank, "mudança" seria um só verbo.
 *
 * companyId NUNCA entra em DTO — é sempre derivado do req.user no service
 * (anti-pattern do CLAUDE.md §14: "aceitar companyId vindo do body").
 */

import type { Application as PrismaApplication } from "@prisma/client";

// === TYPE ===================================================================
export type Application = PrismaApplication;

// === CONTEXTO DE RISCO — vocabulário e ordem ================================

export const ENVIRONMENTS = ["DEV", "HOMOL", "PROD"] as const;
export type Environment = (typeof ENVIRONMENTS)[number];

export const CRITICALITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type Criticality = (typeof CRITICALITIES)[number];

export const DATA_SENSITIVITIES = ["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED"] as const;
export type DataSensitivity = (typeof DATA_SENSITIVITIES)[number];

/**
 * Ranking de risco de cada dimensão — índice = posição na ordem.
 * `DEV < HOMOL < PROD`, `LOW < … < CRITICAL`, `PUBLIC < … < RESTRICTED`,
 * `false < true`. Um valor fora do vocabulário recebe -1, que é "menor que
 * tudo": uma app com valor legado inválido pode ser corrigida para qualquer
 * coisa, mas nada pode ser rebaixado até ela.
 */
export const ENVIRONMENT_RANK: Record<string, number> = { DEV: 0, HOMOL: 1, PROD: 2 };
export const CRITICALITY_RANK: Record<string, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };
export const DATA_SENSITIVITY_RANK: Record<string, number> = { PUBLIC: 0, INTERNAL: 1, CONFIDENTIAL: 2, RESTRICTED: 3 };

/** Os campos que compõem o contexto de risco — o conjunto que a regra D2 governa. */
export const RISK_CONTEXT_FIELDS = [
  "environment",
  "criticality",
  "internetFacing",
  "dataSensitivity",
] as const;
export type RiskContextField = (typeof RISK_CONTEXT_FIELDS)[number];

/** O contexto de risco como bloco — o que vai embutido no DTO do finding. */
export type RiskContext = {
  environment: string;
  criticality: string;
  internetFacing: boolean;
  dataSensitivity: string;
};

/**
 * Direção de uma mudança em UMA dimensão do contexto.
 *   INCREASE — o alvo fica mais exposto/crítico (CLIENT OWNER pode)
 *   DECREASE — o alvo fica menos exposto/crítico (só ADMIN)
 *   NONE     — sem mudança
 */
export type RiskChangeDirection = "INCREASE" | "DECREASE" | "NONE";

function direcaoPorRank(rank: Record<string, number>, antes: string, depois: string): RiskChangeDirection {
  const a = rank[antes] ?? -1;
  const d = rank[depois] ?? -1;
  if (d > a) return "INCREASE";
  if (d < a) return "DECREASE";
  return "NONE";
}

/**
 * Classifica a mudança de cada dimensão do contexto.
 *
 * Função pura, sem I/O — é o coração da regra D2 e é testada em isolamento.
 * Devolve só as dimensões que de fato mudaram, com a direção de cada uma; o
 * service decide o que fazer com isso (autorizar, recusar, auditar).
 */
export function classificarMudancaDeContexto(
  antes: RiskContext,
  depois: Partial<RiskContext>,
): Array<{ field: RiskContextField; from: string | boolean; to: string | boolean; direction: RiskChangeDirection }> {
  const mudancas: Array<{
    field: RiskContextField;
    from: string | boolean;
    to: string | boolean;
    direction: RiskChangeDirection;
  }> = [];

  if (depois.environment !== undefined && depois.environment !== antes.environment) {
    mudancas.push({
      field: "environment",
      from: antes.environment,
      to: depois.environment,
      direction: direcaoPorRank(ENVIRONMENT_RANK, antes.environment, depois.environment),
    });
  }
  if (depois.criticality !== undefined && depois.criticality !== antes.criticality) {
    mudancas.push({
      field: "criticality",
      from: antes.criticality,
      to: depois.criticality,
      direction: direcaoPorRank(CRITICALITY_RANK, antes.criticality, depois.criticality),
    });
  }
  if (depois.internetFacing !== undefined && depois.internetFacing !== antes.internetFacing) {
    mudancas.push({
      field: "internetFacing",
      from: antes.internetFacing,
      to: depois.internetFacing,
      // false → true expõe; true → false esconde
      direction: depois.internetFacing ? "INCREASE" : "DECREASE",
    });
  }
  if (depois.dataSensitivity !== undefined && depois.dataSensitivity !== antes.dataSensitivity) {
    mudancas.push({
      field: "dataSensitivity",
      from: antes.dataSensitivity,
      to: depois.dataSensitivity,
      direction: direcaoPorRank(DATA_SENSITIVITY_RANK, antes.dataSensitivity, depois.dataSensitivity),
    });
  }

  return mudancas;
}

// === DTOs ===================================================================
export type CreateApplicationDTO = {
  name: string;
  url?: string;
  environment?: string; // PROD | HOMOL | DEV — default PROD
  techStack?: string;
  description?: string;
  // contexto de risco — todos opcionais na criação (defaults do schema)
  criticality?: string;
  internetFacing?: boolean;
  dataSensitivity?: string;
  businessOwner?: string | null;
  technicalOwner?: string | null;
};

export type UpdateApplicationDTO = Partial<CreateApplicationDTO>;

export type ApplicationResponseDTO = {
  id: string;
  name: string;
  url: string | null;
  environment: string;
  techStack: string | null;
  description: string | null;
  companyId: string;
  isActive: boolean;
  criticality: string;
  internetFacing: boolean;
  dataSensitivity: string;
  businessOwner: string | null;
  technicalOwner: string | null;
  createdAt: string;
  updatedAt: string;
};

// === ENTITY =================================================================
export class ApplicationEntity {
  constructor(private readonly data: Application) {}

  toResponse(): ApplicationResponseDTO {
    return {
      id: this.data.id,
      name: this.data.name,
      url: this.data.url,
      environment: this.data.environment,
      techStack: this.data.techStack,
      description: this.data.description,
      companyId: this.data.companyId,
      isActive: this.data.isActive,
      criticality: this.data.criticality,
      internetFacing: this.data.internetFacing,
      dataSensitivity: this.data.dataSensitivity,
      businessOwner: this.data.businessOwner,
      technicalOwner: this.data.technicalOwner,
      createdAt: this.data.createdAt.toISOString(),
      updatedAt: this.data.updatedAt.toISOString(),
    };
  }

  /** O bloco de contexto — o que o finding embute para quem não lê /applications. */
  riskContext(): RiskContext {
    return {
      environment: this.data.environment,
      criticality: this.data.criticality,
      internetFacing: this.data.internetFacing,
      dataSensitivity: this.data.dataSensitivity,
    };
  }
}
