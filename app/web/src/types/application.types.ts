/**
 * application.types.ts
 *
 * Espelha `ApplicationResponseDTO` e o vocabulário de contexto de risco do
 * backend (app/api/src/models/application.model.ts). Desde o CP-1 a
 * aplicação carrega quatro fatos sobre o ALVO — criticidade, ambiente,
 * exposição à internet e sensibilidade do dado — que alimentam o VRS.
 *
 * As ORDENS (`*_ORDER`) importam: são o que a tela usa para saber se uma
 * mudança SOBE ou DESCE o risco, e portanto se um CLIENT OWNER pode fazê-la
 * sozinho (subir) ou precisa de ADMIN (descer) — docs/DECISIONS.md D2.
 */

export const ENVIRONMENTS = ["DEV", "HOMOL", "PROD"] as const;
export type Environment = (typeof ENVIRONMENTS)[number];

export const CRITICALITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type Criticality = (typeof CRITICALITIES)[number];

export const DATA_SENSITIVITIES = ["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED"] as const;
export type DataSensitivity = (typeof DATA_SENSITIVITIES)[number];

export const ENVIRONMENT_LABELS: Record<Environment, string> = {
  DEV: "Desenvolvimento",
  HOMOL: "Homologação",
  PROD: "Produção",
};

export const CRITICALITY_LABELS: Record<Criticality, string> = {
  LOW: "Baixa",
  MEDIUM: "Média",
  HIGH: "Alta",
  CRITICAL: "Crítica",
};

export const DATA_SENSITIVITY_LABELS: Record<DataSensitivity, string> = {
  PUBLIC: "Público",
  INTERNAL: "Interno",
  CONFIDENTIAL: "Confidencial",
  RESTRICTED: "Restrito",
};

/** Posição na ordem de risco. Menor = menos risco. Fora do vocabulário = -1. */
export const rankOf = (ordem: readonly string[], valor: string): number => ordem.indexOf(valor);

/** O bloco de contexto — o mesmo que `GET /vulnerabilities/:id` embute como `applicationContext`. */
export interface ApplicationRiskContext {
  environment: string;
  criticality: string;
  internetFacing: boolean;
  dataSensitivity: string;
}

export interface Application extends ApplicationRiskContext {
  id: string;
  name: string;
  url: string | null;
  techStack: string | null;
  description: string | null;
  companyId: string;
  isActive: boolean;
  businessOwner: string | null;
  technicalOwner: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateApplicationInput {
  name: string;
  url?: string;
  environment?: string;
  techStack?: string;
  description?: string;
  criticality?: string;
  internetFacing?: boolean;
  dataSensitivity?: string;
  businessOwner?: string | null;
  technicalOwner?: string | null;
}

/** O que o formulário de contexto envia — só os campos de risco e os donos. */
export type UpdateRiskContextInput = Pick<
  CreateApplicationInput,
  "environment" | "criticality" | "internetFacing" | "dataSensitivity" | "businessOwner" | "technicalOwner"
>;
