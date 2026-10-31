/**
 * nvd-cve.service.ts
 *
 * Enriquece CVEs com os dados oficiais do NVD (NIST): CVSS (nota, versão e
 * vetor), CWE, descrição, data de publicação e referências.
 *
 * Limite do NVD: sem chave, 5 consultas a cada 30 s; com chave, 50. Por isso:
 *   1. cache global no banco (`CveRecord`) — CVE é dado público, sem tenant;
 *   2. primeiro, UMA consulta por software com versão (`virtualMatchString`
 *      com o CPE que a InternetDB devolveu): traz de uma vez todas as CVEs
 *      daquela versão, com CVSS (Apache 2.4.7 → 126 CVEs em ~1 s);
 *   3. só o que sobrar vai por `cveId`, uma a uma, com intervalo de 6,5 s
 *      (0,7 s com chave) e teto por scan (25 sem chave, 200 com chave). O que
 *      passar do teto fica "CVSS pendente" — nunca um CVSS inventado.
 * Se o NVD responder 403/429/5xx, para de consultar no scan: insistir só
 * prolonga o bloqueio.
 *
 * `parseNvdCve` e `riscoPorCvss` são PURAS (testáveis sem rede).
 */

import { DastRisk } from "@prisma/client";
import type { CveRecord } from "@prisma/client";
import type { CveRecordRepository, SaveCveRecordInput } from "../../repositories/cve-record.repository";

export type CveInfo = SaveCveRecordInput;

export const CVE_ID_RE = /^CVE-\d{4}-\d{4,}$/;
const NVD_URL = "https://services.nvd.nist.gov/rest/json/cves/2.0";
const TIMEOUT_MS = 15_000;
/** CVE com CVSS publicado não muda de nota com frequência; sem CVSS, revisita antes. */
const VALIDADE_COM_CVSS_MS = 7 * 24 * 3600_000;
const VALIDADE_SEM_CVSS_MS = 24 * 3600_000;
const MAX_REFERENCIAS = 5;
/** Consultas por software num scan; um IP de provedor pode anunciar dezenas de CPEs. */
const MAX_CPES = 5;

/** Faixas oficiais do CVSS v3/v4. Sem CVSS → INFO: nunca infla um risco desconhecido. */
export function riscoPorCvss(nota: number | null | undefined): DastRisk {
  if (nota === null || nota === undefined) return DastRisk.INFO;
  if (nota >= 7) return DastRisk.HIGH;
  if (nota >= 4) return DastRisk.MEDIUM;
  if (nota > 0) return DastRisk.LOW;
  return DastRisk.INFO;
}

/** Rótulo de severidade do CVSS (inclui "Crítica", que o DastRisk não tem). */
export function severidadeCvss(nota: number | null | undefined): string {
  if (nota === null || nota === undefined) return "pendente";
  if (nota >= 9) return "Crítica";
  if (nota >= 7) return "Alta";
  if (nota >= 4) return "Média";
  if (nota > 0) return "Baixa";
  return "Nenhuma";
}

interface NvdMetric {
  type?: string;
  cvssData?: { version?: string; vectorString?: string; baseScore?: number };
}

/** Prefere a métrica mais nova (v4.0 > v3.1 > v3.0 > v2) e, nela, a "Primary" (do próprio NVD). */
function escolherMetrica(metrics: Record<string, NvdMetric[] | undefined> | undefined): NvdMetric | null {
  for (const chave of ["cvssMetricV40", "cvssMetricV31", "cvssMetricV30", "cvssMetricV2"]) {
    const lista = metrics?.[chave];
    if (lista?.length) return lista.find((m) => m.type === "Primary") ?? lista[0];
  }
  return null;
}

interface NvdCve {
  id?: string;
  descriptions?: { lang: string; value: string }[];
  metrics?: Record<string, NvdMetric[]>;
  weaknesses?: { type?: string; description?: { value: string }[] }[];
  published?: string;
  references?: { url: string }[];
}

const listaDoNvd = (json: unknown): NvdCve[] =>
  ((json as { vulnerabilities?: { cve?: NvdCve }[] })?.vulnerabilities ?? []).flatMap((v) => (v.cve ? [v.cve] : []));

/** Converte a resposta do NVD (API 2.0, consulta por `cveId`) no que guardamos. null = NVD não conhece a CVE. */
export function parseNvdCve(id: string, json: unknown): CveInfo | null {
  const cve = listaDoNvd(json)[0];
  return cve ? converter(id, cve) : null;
}

/** Todas as CVEs de uma resposta (consulta por software), indexadas pelo id. PURA. */
export function parseNvdLista(json: unknown): Map<string, CveInfo> {
  return new Map(listaDoNvd(json).flatMap((c) => (c.id ? [[c.id, converter(c.id, c)] as const] : [])));
}

/** "cpe:/a:apache:http_server:2.4.7" (CPE 2.2 da InternetDB) → "cpe:2.3:a:apache:http_server:2.4.7"; sem versão → null. */
export function cpeComVersao(cpe: string): string | null {
  const [parte, fornecedor, produto, versao] = cpe.slice("cpe:/".length).split(":");
  if (!cpe.startsWith("cpe:/") || !parte || !fornecedor || !produto || !versao) return null;
  return `cpe:2.3:${parte}:${fornecedor}:${produto}:${versao}`;
}

function converter(id: string, cve: NvdCve): CveInfo {
  const metrica = escolherMetrica(cve.metrics);
  const cwe = cve.weaknesses
    ?.flatMap((w) => w.description ?? [])
    .map((d) => d.value)
    .find((v) => /^CWE-\d+$/.test(v));
  const publicado = cve.published ? new Date(cve.published) : null;

  return {
    id,
    description: cve.descriptions?.find((d) => d.lang === "en")?.value ?? null,
    cvssScore: typeof metrica?.cvssData?.baseScore === "number" ? metrica.cvssData.baseScore : null,
    cvssVersion: metrica?.cvssData?.version ?? null,
    cvssVector: metrica?.cvssData?.vectorString ?? null,
    cweId: cwe ? cwe.replace("CWE-", "") : null,
    publishedAt: publicado && !Number.isNaN(publicado.getTime()) ? publicado : null,
    references: (cve.references ?? []).slice(0, MAX_REFERENCIAS).map((r) => r.url),
  };
}

function doCache(r: CveRecord): CveInfo {
  return {
    id: r.id,
    description: r.description,
    cvssScore: r.cvssScore,
    cvssVersion: r.cvssVersion,
    cvssVector: r.cvssVector,
    cweId: r.cweId,
    publishedAt: r.publishedAt,
    references: Array.isArray(r.references) ? (r.references as string[]) : [],
  };
}

function aindaValido(r: CveRecord, agora: number): boolean {
  const validade = r.cvssScore === null ? VALIDADE_SEM_CVSS_MS : VALIDADE_COM_CVSS_MS;
  return agora - r.fetchedAt.getTime() < validade;
}

/** Ano e número decrescentes: as CVEs mais recentes primeiro na fila do NVD. */
function maisRecentePrimeiro(a: string, b: string): number {
  const [, anoA, numA] = a.split("-");
  const [, anoB, numB] = b.split("-");
  return Number(anoB) - Number(anoA) || Number(numB) - Number(numA);
}

export interface ResultadoEnriquecimento {
  infos: Map<string, CveInfo>;
  /** Não consultadas: teto do scan atingido ou NVD indisponível. */
  pendentes: string[];
  /** Por que parou antes do fim, se parou. */
  interrupcao: string | null;
}

type Esperar = (ms: number, signal?: AbortSignal) => Promise<void>;

const esperarPadrao: Esperar = (ms, signal) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(signal.reason);
      },
      { once: true },
    );
  });

export class NvdCveService {
  private readonly intervaloMs: number;
  private readonly tetoPorScan: number;

  constructor(
    private readonly cache: Pick<CveRecordRepository, "findManyByIds" | "upsert">,
    private readonly apiKey: string | null,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly esperar: Esperar = esperarPadrao,
  ) {
    this.intervaloMs = apiKey ? 700 : 6_500;
    this.tetoPorScan = apiKey ? 200 : 25;
  }

  async enriquecer(
    ids: string[],
    opts: { signal?: AbortSignal; pulso?: () => void; cpes?: string[] } = {},
  ): Promise<ResultadoEnriquecimento> {
    const validos = [...new Set(ids.filter((id) => CVE_ID_RE.test(id)))];
    const infos = new Map<string, CveInfo>();
    const agora = Date.now();

    for (const r of await this.cache.findManyByIds(validos)) {
      if (aindaValido(r, agora)) infos.set(r.id, doCache(r));
    }

    let consultas = 0;
    const faltando = () => validos.filter((id) => !infos.has(id));

    // Etapa 1: uma consulta por software com versão cobre a maioria das CVEs.
    const cpes = [...new Set((opts.cpes ?? []).map(cpeComVersao).filter((c): c is string => !!c))].slice(0, MAX_CPES);
    for (const cpe of cpes) {
      if (faltando().length === 0) break;
      opts.pulso?.();
      if (consultas++ > 0) await this.esperar(this.intervaloMs, opts.signal);
      const resposta = await this.consultar(`virtualMatchString=${encodeURIComponent(cpe)}&resultsPerPage=2000`, opts.signal);
      if (!resposta.ok) continue; // a etapa 2 ainda tenta essas CVEs uma a uma
      for (const [id, info] of parseNvdLista(resposta.json)) {
        if (!validos.includes(id) || infos.has(id)) continue;
        infos.set(id, info);
        await this.cache.upsert(info).catch((err: unknown) => console.warn(`[DAST] falha ao gravar cache da ${id}`, err));
      }
    }

    // Etapa 2: o que sobrou, uma a uma, até o teto do scan.
    const fila = faltando().sort(maisRecentePrimeiro);
    const aConsultar = fila.slice(0, this.tetoPorScan);
    const pendentes = fila.slice(this.tetoPorScan);
    let interrupcao: string | null =
      pendentes.length > 0 ? `teto de ${this.tetoPorScan} consultas ao NVD por scan${this.apiKey ? "" : " sem chave de API"}` : null;

    for (let i = 0; i < aConsultar.length; i += 1) {
      const id = aConsultar[i];
      opts.pulso?.();
      if (consultas++ > 0) await this.esperar(this.intervaloMs, opts.signal);

      let resposta: Response;
      try {
        resposta = await this.fetchImpl(`${NVD_URL}?cveId=${encodeURIComponent(id)}`, {
          headers: { ...(this.apiKey ? { apiKey: this.apiKey } : {}), "user-agent": "Vulnera-DAST/nvd" },
          signal: AbortSignal.any([AbortSignal.timeout(TIMEOUT_MS), ...(opts.signal ? [opts.signal] : [])]),
        });
      } catch (erro) {
        if (opts.signal?.aborted) throw erro;
        pendentes.push(...aConsultar.slice(i));
        interrupcao = "o NVD não respondeu a tempo";
        break;
      }

      if (!resposta.ok) {
        await resposta.body?.cancel().catch(() => undefined);
        pendentes.push(...aConsultar.slice(i));
        interrupcao =
          resposta.status === 403 || resposta.status === 429
            ? `o NVD limitou as consultas (HTTP ${resposta.status})`
            : `o NVD está indisponível (HTTP ${resposta.status})`;
        break;
      }

      const info = parseNvdCve(id, await resposta.json()) ?? {
        // NVD não conhece (CVE reservada/rejeitada): guarda "sem CVSS" para não perguntar de novo hoje.
        id,
        description: null,
        cvssScore: null,
        cvssVersion: null,
        cvssVector: null,
        cweId: null,
        publishedAt: null,
        references: [],
      };
      infos.set(id, info);
      await this.cache.upsert(info).catch((err: unknown) => console.warn(`[DAST] falha ao gravar cache da ${id}`, err));
    }

    return { infos, pendentes, interrupcao };
  }

  /** Consulta genérica da etapa 1; falha vira `ok: false` (a etapa 2 decide o que fazer). */
  private async consultar(query: string, signal?: AbortSignal): Promise<{ ok: boolean; json?: unknown }> {
    try {
      const resposta = await this.fetchImpl(`${NVD_URL}?${query}`, {
        headers: { ...(this.apiKey ? { apiKey: this.apiKey } : {}), "user-agent": "Vulnera-DAST/nvd" },
        signal: AbortSignal.any([AbortSignal.timeout(TIMEOUT_MS * 2), ...(signal ? [signal] : [])]),
      });
      if (!resposta.ok) {
        await resposta.body?.cancel().catch(() => undefined);
        return { ok: false };
      }
      return { ok: true, json: await resposta.json() };
    } catch (erro) {
      if (signal?.aborted) throw erro;
      return { ok: false };
    }
  }
}
