/**
 * threat-intel.model.ts
 *
 * Contratos HTTP da Threat Intel (ADR-053) e a serialização das linhas do
 * banco para eles. Datas sempre em ISO; nada de Prisma vaza para a web.
 */

import type { TechAsset, ThreatAdvisory, ThreatSyncRun } from "@prisma/client";
import type { CasamentoCompleto } from "../repositories/threat-intel.repository";

export interface PermissoesThreatIntel {
  editarInventario: boolean;
  triar: boolean;
  promover: boolean;
  sincronizar: boolean;
}

export interface AtivoDTO {
  id: string;
  kind: string;
  ecosystem: string | null;
  packageName: string | null;
  cpePart: string | null;
  cpeVendor: string | null;
  cpeProduct: string | null;
  version: string | null;
  displayName: string;
  status: string;
  source: string;
  sourceRef: string | null;
  confirmedAt: string | null;
  lastSyncedAt: string | null;
  createdAt: string;
  casamentos: number;
}

export interface AvisoDTO {
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

export interface CasamentoDTO {
  id: string;
  advisory: AvisoDTO;
  asset: { id: string; displayName: string; kind: string; version: string | null };
  versionConfirmed: boolean;
  preexisting: boolean;
  fixedVersion: string | null;
  triageStatus: string;
  triageNote: string | null;
  triagedByName: string | null;
  triagedAt: string | null;
  createdAt: string;
  promotedVulnerability: { id: string; projectId: string; status: string } | null;
}

export interface ExecucaoDTO {
  id: string;
  trigger: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  sources: Record<string, { ok: boolean; itens: number; erro?: string }>;
  newAdvisories: number;
  newMatches: number;
  notifications: number;
  errorMessage: string | null;
}

const iso = (d: Date | null) => (d ? d.toISOString() : null);
const lista = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

export function toAtivoDTO(a: TechAsset & { _count?: { matches: number } }): AtivoDTO {
  return {
    id: a.id,
    kind: a.kind,
    ecosystem: a.ecosystem,
    packageName: a.packageName,
    cpePart: a.cpePart,
    cpeVendor: a.cpeVendor,
    cpeProduct: a.cpeProduct,
    version: a.version,
    displayName: a.displayName,
    status: a.status,
    source: a.source,
    sourceRef: a.sourceRef,
    confirmedAt: iso(a.confirmedAt),
    lastSyncedAt: iso(a.lastSyncedAt),
    createdAt: a.createdAt.toISOString(),
    casamentos: a._count?.matches ?? 0,
  };
}

export function toAvisoDTO(a: ThreatAdvisory): AvisoDTO {
  return {
    id: a.id,
    aliases: lista(a.aliases),
    source: a.source,
    title: a.title,
    description: a.description,
    cvssScore: a.cvssScore,
    cvssVersion: a.cvssVersion,
    cvssVector: a.cvssVector,
    severity: a.severity,
    cweId: a.cweId,
    publishedAt: iso(a.publishedAt),
    references: lista(a.references),
    kev: a.kev,
    kevAddedAt: iso(a.kevAddedAt),
    kevDueDate: iso(a.kevDueDate),
    kevRansomware: a.kevRansomware,
    epssScore: a.epssScore,
    epssPercentile: a.epssPercentile,
  };
}

export function toCasamentoDTO(m: CasamentoCompleto): CasamentoDTO {
  return {
    id: m.id,
    advisory: toAvisoDTO(m.advisory),
    asset: { id: m.asset.id, displayName: m.asset.displayName, kind: m.asset.kind, version: m.asset.version },
    versionConfirmed: m.versionConfirmed,
    preexisting: m.preexisting,
    fixedVersion: m.fixedVersion,
    triageStatus: m.triageStatus,
    triageNote: m.triageNote,
    triagedByName: m.triagedBy?.name ?? null,
    triagedAt: iso(m.triagedAt),
    createdAt: m.createdAt.toISOString(),
    promotedVulnerability: m.promotedVulnerability,
  };
}

export function toExecucaoDTO(r: ThreatSyncRun): ExecucaoDTO {
  return {
    id: r.id,
    trigger: r.trigger,
    status: r.status,
    startedAt: r.startedAt.toISOString(),
    finishedAt: iso(r.finishedAt),
    sources: (r.sources && typeof r.sources === "object" ? r.sources : {}) as ExecucaoDTO["sources"],
    newAdvisories: r.newAdvisories,
    newMatches: r.newMatches,
    notifications: r.notifications,
    errorMessage: r.errorMessage,
  };
}
