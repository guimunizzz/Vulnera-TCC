/**
 * threat-intel.types.ts — contratos da Threat Intel (ADR-053), espelho de
 * `app/api/src/models/threat-intel.model.ts`, e da central de notificações.
 */

import type { DastTriageStatus } from "./dast.types";

export const ECOSSISTEMAS = ["npm", "PyPI", "Maven", "Go", "NuGet", "RubyGems", "crates.io", "Packagist"] as const;
export type Ecossistema = (typeof ECOSSISTEMAS)[number];

export interface PermissoesThreatIntel {
  editarInventario: boolean;
  triar: boolean;
  promover: boolean;
  sincronizar: boolean;
}

export interface EmpresaTI {
  id: string;
  name: string;
}

export interface ResultadoFonte {
  ok: boolean;
  itens: number;
  erro?: string;
}

export interface ExecucaoSync {
  id: string;
  trigger: "SCHEDULED" | "MANUAL" | "ASSET";
  status: "RUNNING" | "OK" | "PARTIAL" | "FAILED";
  startedAt: string;
  finishedAt: string | null;
  sources: Record<string, ResultadoFonte>;
  newAdvisories: number;
  newMatches: number;
  notifications: number;
  errorMessage: string | null;
}

export interface ResumoTI {
  companyId: string;
  permissoes: PermissoesThreatIntel;
  inventario: { confirmados: number; sugeridos: number; descartados: number };
  casamentos: { porTriagem: Partial<Record<DastTriageStatus, number>>; kevAbertos: number; criticosAbertos: number; novosSemana: number };
  ultimaExecucao: ExecucaoSync | null;
  sincronizando: boolean;
}

export interface AtivoTI {
  id: string;
  kind: "PACKAGE" | "PRODUCT";
  ecosystem: string | null;
  packageName: string | null;
  cpePart: string | null;
  cpeVendor: string | null;
  cpeProduct: string | null;
  version: string | null;
  displayName: string;
  status: "SUGGESTED" | "CONFIRMED" | "DISMISSED";
  source: "MANUAL" | "SBOM" | "FINGERPRINT";
  sourceRef: string | null;
  confirmedAt: string | null;
  lastSyncedAt: string | null;
  createdAt: string;
  casamentos: number;
}

export interface AvisoTI {
  id: string;
  aliases: string[];
  source: string;
  title: string | null;
  description: string | null;
  cvssScore: number | null;
  cvssVersion: string | null;
  cvssVector: string | null;
  severity: string | null;
  cweId: string | null;
  publishedAt: string | null;
  references: string[];
  kev: boolean;
  kevAddedAt: string | null;
  kevDueDate: string | null;
  kevRansomware: boolean;
  epssScore: number | null;
  epssPercentile: number | null;
}

export interface CasamentoTI {
  id: string;
  advisory: AvisoTI;
  asset: { id: string; displayName: string; kind: string; version: string | null };
  versionConfirmed: boolean;
  preexisting: boolean;
  fixedVersion: string | null;
  triageStatus: DastTriageStatus;
  triageNote: string | null;
  triagedByName: string | null;
  triagedAt: string | null;
  createdAt: string;
  promotedVulnerability: { id: string; projectId: string; status: string } | null;
}

export interface ProdutoCpe {
  cpePart: string;
  cpeVendor: string;
  cpeProduct: string;
  titulo: string;
  exemplo: string;
}

export interface NovoAtivoInput {
  companyId?: string;
  kind: "PACKAGE" | "PRODUCT";
  ecosystem?: string;
  packageName?: string;
  cpePart?: string;
  cpeVendor?: string;
  cpeProduct?: string;
  version?: string | null;
}

export interface RascunhoPromocaoTI {
  title: string;
  description: string;
  owaspCategory: string;
  cvssVector: string;
  cvssVectorSource: string;
  recommendation: string;
  projetos: { id: string; name: string }[];
  alreadyPromotedTo: string | null;
}

export interface PromoverTIInput {
  projectId: string;
  title: string;
  description: string;
  owaspCategory: string;
  cvssVector: string;
  recommendation?: string;
}

export type AvisoDoFeed = AvisoTI & { afeta: boolean };

export interface Notificacao {
  id: string;
  category: string;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

export const ROTULO_ORIGEM_ATIVO: Record<AtivoTI["source"], string> = {
  MANUAL: "Manual",
  SBOM: "SBOM",
  FINGERPRINT: "Fingerprint DAST",
};

export const ROTULO_FONTE: Record<string, string> = {
  KEV: "CISA KEV",
  NVD_FEED: "NVD — CVEs publicadas",
  NVD_PRODUTOS: "NVD — produtos do inventário",
  OSV: "OSV — pacotes do inventário",
  EPSS: "FIRST EPSS",
};
