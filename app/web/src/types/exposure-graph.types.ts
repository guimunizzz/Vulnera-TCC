/**
 * exposure-graph.types.ts
 *
 * Contrato de `GET /companies/me/exposure-graph` (Exposure Graph, CP-8): o
 * estado atual das aplicações ativas da empresa, com as vulnerabilidades
 * abertas (`OPEN`/`IN_PROGRESS`) por severidade e por categoria OWASP.
 */

export type SeveridadeVuln = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export interface CategoriaExposta {
  owaspCategory: string;
  abertas: number;
  piorSeveridade: SeveridadeVuln;
}

export interface VulnPrincipal {
  id: string;
  title: string;
  severityFinal: string;
  status: string;
  owaspCategory: string;
}

export interface AplicacaoExposta {
  id: string;
  name: string;
  url: string | null;
  environment: string;
  criticality: string;
  internetFacing: boolean;
  dataSensitivity: string;
  abertas: Record<SeveridadeVuln, number>;
  totalAbertas: number;
  totalResolvidas: number;
  piorSeveridade: SeveridadeVuln | null;
  categorias: CategoriaExposta[];
  principais: VulnPrincipal[];
}

export interface ExposureGraph {
  companyId: string;
  geradoEm: string;
  aplicacoes: AplicacaoExposta[];
}
