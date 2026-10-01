/**
 * dast-findings.service.ts
 *
 * Pipeline de findings do DAST: lê o `report.json` gerado pelo ZAP (real ou
 * simulado — mesmo formato, ver zap-runner.service.ts), acha de escopo,
 * normaliza URL, calcula fingerprint e devolve a lista de candidatos a
 * `DastFinding` já deduplicada — pronta pra persistir.
 *
 * Este arquivo é PURO: não importa PrismaClient, não abre transação, não
 * escreve nada. A única exceção é `DastRisk`, importado de `@prisma/client`
 * só pelos VALORES do enum (não dá pra usar `import type` e ainda acessar
 * `DastRisk.HIGH` em runtime) — mesma ideia de `import type { Vulnerability }`
 * que evidence.service.ts já faz, adaptada pro nosso único enum nativo. Quem
 * abre a transação e grava é o repository (Fase 4) — CLAUDE.md P1: só
 * Repository toca `@prisma/client` de verdade (queries).
 *
 * Por que a evidência fica FORA do fingerprint: o valor de `evidence` (o
 * trecho de request/response que provou a vulnerabilidade) muda de scan pra
 * scan mesmo quando é a MESMA vulnerabilidade — session token diferente,
 * timestamp diferente, etc. Se entrasse no hash, o mesmo achado geraria um
 * fingerprint novo toda vez, e a app nunca reconheceria "isso já existia".
 *
 * Por que a normalização de URL importa: sem ela, `/users/1/profile` e
 * `/users/999/profile` (mesmo bug, instância diferente por causa do ID) viram
 * dois fingerprints diferentes — a lista de achados infla a cada scan sem
 * necessidade. Normaliza ANTES de calcular o hash: segmento puramente
 * numérico vira `{id}`, UUID vira `{uuid}`, query param com valor longo
 * (> 16 chars — geralmente token/JWT/assinatura) é descartado.
 */

import { createHash } from "crypto";
import * as fs from "fs/promises";
import { DastRisk } from "@prisma/client";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NUMERIC_ID_RE = /^\d+$/;
const MAX_QUERY_VALUE_LEN = 16;

// ============================================================================
// Formato bruto do report.json (campos reais, mapeados na Fase 0)
// ============================================================================

export interface ZapInstance {
  id?: string;
  uri: string;
  nodeName?: string;
  method?: string;
  param?: string;
  attack?: string;
  evidence?: string;
  otherinfo?: string;
}

export interface ZapAlert {
  pluginid: string;
  alertRef?: string;
  alert: string;
  name?: string;
  riskcode: string; // "0".."3"
  confidence: string; // "1".."4"
  riskdesc: string; // ex: "Medium (High)" — risco (numérico via riskcode) + confiança em texto entre parênteses
  desc?: string; // HTML
  solution?: string; // HTML
  reference?: string; // HTML
  cweid?: string;
  wascid?: string;
  count?: string;
  instances: ZapInstance[];
}

export interface ZapSite {
  "@name": string;
  "@host": string;
  "@port"?: string;
  "@ssl"?: string;
  alerts: ZapAlert[];
}

export interface ZapReport {
  site: ZapSite[];
  [key: string]: unknown;
}

export async function parseReportFile(jsonPath: string): Promise<ZapReport> {
  const raw = await fs.readFile(jsonPath, "utf-8");
  const parsed = JSON.parse(raw) as ZapReport;
  if (!parsed || !Array.isArray(parsed.site)) {
    throw new Error("REPORT_JSON_INVALID");
  }
  return parsed;
}

// ============================================================================
// Mapeamento de risco / confiança
// ============================================================================

export function mapRiskCode(riskcode: string): DastRisk {
  switch (riskcode) {
    case "3":
      return DastRisk.HIGH;
    case "2":
      return DastRisk.MEDIUM;
    case "1":
      return DastRisk.LOW;
    case "0":
    default:
      // ZAP não documenta valor fora de 0-3; default INFO é o mais seguro
      // (nunca infla artificialmente a severidade de um achado desconhecido).
      return DastRisk.INFO;
  }
}

const CONFIDENCE_BY_CODE: Record<string, string> = {
  "0": "False Positive",
  "1": "Low",
  "2": "Medium",
  "3": "High",
  "4": "Confirmed",
};

/** Prefere o texto entre parênteses do riskdesc (ex: "Medium (High)" -> "High"); cai pro código numérico se não bater o formato. */
export function extractConfidenceLabel(riskdesc: string, rawConfidence: string): string {
  const match = /\(([^)]+)\)\s*$/.exec(riskdesc ?? "");
  if (match) return match[1];
  return CONFIDENCE_BY_CODE[rawConfidence] ?? rawConfidence;
}

// ============================================================================
// Normalização de URL + fingerprint
// ============================================================================

/** Segmento numérico -> {id}; UUID -> {uuid}; query param com valor > 16 chars é descartado. Sem host — o mesmo padrão de path deve casar entre scans do MESMO alvo. */
export function normalizeUrl(rawUrl: string): string {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return rawUrl; // instância com URI malformada — normalização vira no-op, não quebra o pipeline
  }

  const segments = url.pathname.split("/").map((segment) => {
    if (segment === "") return segment;
    if (UUID_RE.test(segment)) return "{uuid}";
    if (NUMERIC_ID_RE.test(segment)) return "{id}";
    return segment;
  });
  const normalizedPath = segments.join("/");

  const keys = Array.from(new Set(url.searchParams.keys())).sort();
  const keptParams: string[] = [];
  for (const key of keys) {
    const value = url.searchParams.get(key) ?? "";
    if (value.length > MAX_QUERY_VALUE_LEN) continue;
    keptParams.push(`${key}=${value}`);
  }

  return keptParams.length > 0 ? `${normalizedPath}?${keptParams.join("&")}` : normalizedPath;
}

export function computeFingerprint(pluginId: string, normalizedUrl: string, param: string | null | undefined): string {
  const base = `${pluginId}|${normalizedUrl}|${param ?? ""}`;
  return createHash("sha256").update(base).digest("hex");
}

// ============================================================================
// Escopo — descarta instância cujo host não é o do alvo
// ============================================================================

export function isInScope(instanceUri: string, targetHostname: string): boolean {
  try {
    const uri = new URL(instanceUri);
    return uri.hostname.toLowerCase() === targetHostname.toLowerCase();
  } catch {
    return false; // URI que nem parseia como URL não é um achado utilizável — descarta
  }
}

// ============================================================================
// Limpeza de HTML — desc/solution/reference vêm com <p>/<br> do ZAP
// ============================================================================

const HTML_ENTITIES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
};

export function stripHtml(html: string | undefined | null): string | null {
  if (!html) return null;
  let text = html.replace(/<\/(p|li|div)>/gi, "\n").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "");
  for (const [entity, char] of Object.entries(HTML_ENTITIES)) {
    text = text.split(entity).join(char);
  }
  return text.trim();
}

// ============================================================================
// Candidato a DastFinding — sem scanId/id/createdAt (o repository adiciona)
// ============================================================================

export interface CandidateFinding {
  fingerprint: string;
  pluginId: string;
  title: string;
  risk: DastRisk;
  confidence: string;
  cweId: string | null;
  wascId: string | null;
  url: string;
  normalizedUrl: string;
  param: string | null;
  evidence: string | null;
  description: string | null;
  solution: string | null;
  reference: string | null;
}

/**
 * Achata site[].alerts[].instances[] em candidatos a finding, descarta fora
 * de escopo, e deduplica por fingerprint (primeira ocorrência vence — ordem
 * estável do próprio array do JSON). O repository ainda usa
 * `skipDuplicates: true` no createMany como segunda camada de defesa
 * (reprocessar o MESMO scanId duas vezes não deve duplicar linha).
 */
export function buildCandidateFindings(report: ZapReport, targetUrl: string): CandidateFinding[] {
  const targetHostname = new URL(targetUrl).hostname;
  const byFingerprint = new Map<string, CandidateFinding>();

  for (const site of report.site) {
    for (const alert of site.alerts ?? []) {
      const risk = mapRiskCode(alert.riskcode);
      const confidence = extractConfidenceLabel(alert.riskdesc, alert.confidence);
      const title = alert.alert ?? alert.name ?? "Alerta sem título";
      const description = stripHtml(alert.desc);
      const solution = stripHtml(alert.solution);
      const reference = stripHtml(alert.reference);

      for (const instance of alert.instances ?? []) {
        if (!isInScope(instance.uri, targetHostname)) continue;

        const param = instance.param && instance.param.length > 0 ? instance.param : null;
        const normalizedUrl = normalizeUrl(instance.uri);
        const fingerprint = computeFingerprint(alert.pluginid, normalizedUrl, param);

        if (byFingerprint.has(fingerprint)) continue; // já temos um representante desse achado

        byFingerprint.set(fingerprint, {
          fingerprint,
          pluginId: alert.pluginid,
          title,
          risk,
          confidence,
          cweId: alert.cweid ?? null,
          wascId: alert.wascid ?? null,
          url: instance.uri,
          normalizedUrl,
          param,
          evidence: instance.evidence && instance.evidence.length > 0 ? instance.evidence : null,
          description,
          solution,
          reference,
        });
      }
    }
  }

  return Array.from(byFingerprint.values());
}

export interface RiskCounters {
  alertsHigh: number;
  alertsMedium: number;
  alertsLow: number;
  alertsInfo: number;
}

export function countByRisk(findings: CandidateFinding[]): RiskCounters {
  const counters: RiskCounters = { alertsHigh: 0, alertsMedium: 0, alertsLow: 0, alertsInfo: 0 };
  for (const f of findings) {
    if (f.risk === DastRisk.HIGH) counters.alertsHigh += 1;
    else if (f.risk === DastRisk.MEDIUM) counters.alertsMedium += 1;
    else if (f.risk === DastRisk.LOW) counters.alertsLow += 1;
    else counters.alertsInfo += 1;
  }
  return counters;
}

/** Ponto de entrada usado pelo service de negócio (Fase 4): lê o arquivo, monta e devolve os candidatos já filtrados/deduplicados. */
export async function extractFindingsFromReport(jsonPath: string, targetUrl: string): Promise<CandidateFinding[]> {
  const report = await parseReportFile(jsonPath);
  return buildCandidateFindings(report, targetUrl);
}
