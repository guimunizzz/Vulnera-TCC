/**
 * fontes.ts
 *
 * O QUE FAZ
 * Fala com as quatro fontes públicas da Threat Intel (ADR-053) e devolve o JSON
 * já lido pelas funções puras de `utils/threat-intel.util.ts`:
 *   - NVD (NIST): CVEs publicadas, CVEs por produto (CPE) e o dicionário de CPEs;
 *   - OSV (Google/OpenSSF): avisos por pacote e versão;
 *   - CISA KEV: catálogo de CVEs exploradas ativamente;
 *   - FIRST EPSS: probabilidade de exploração.
 *
 * LIMITES DAS FONTES
 * O NVD aceita 5 consultas a cada 30 s sem chave (50 com `NVD_API_KEY`). Todas
 * as chamadas ao NVD deste processo passam por UM intervalo mínimo compartilhado
 * (sincronização e busca de CPE da tela), e um 403/429/5xx devolve
 * `FonteIndisponivel` — quem chamou para de insistir naquela execução.
 *
 * QUEM USA
 * `threat-intel-sync.service.ts` e `threat-intel.service.ts`, via factory. Os
 * testes usam outra implementação de `FontesDeAvisos` (sem rede).
 */

import {
  avisoDoOsv,
  avisosDoNvd,
  catalogoKev,
  idsDoOsvLote,
  notasEpss,
  paginaDoNvd,
  produtosDoDicionarioCpe,
  type AvisoNormalizado,
  type EntradaKev,
} from "../../utils/threat-intel.util";

export class FonteIndisponivel extends Error {
  constructor(
    public readonly fonte: "NVD" | "OSV" | "KEV" | "EPSS",
    motivo: string,
  ) {
    super(`${fonte}: ${motivo}`);
  }
}

export interface RespostaNvd {
  avisos: AvisoNormalizado[];
  /** O JSON cru, para ler a versão corrigida por produto. */
  bruto: unknown;
  /** true = havia mais páginas do que o teto por consulta. */
  truncado: boolean;
}

export interface ConsultaOsv {
  ecosystem: string;
  name: string;
  version: string | null;
}

export interface FontesDeAvisos {
  nvdPublicadas(desde: Date, ate: Date): Promise<RespostaNvd>;
  nvdPorProduto(cpe: string, modificadasDesde: Date | null, ate: Date): Promise<RespostaNvd>;
  nvdBuscarProdutos(termo: string): Promise<ReturnType<typeof produtosDoDicionarioCpe>>;
  osvLote(consultas: ConsultaOsv[]): Promise<string[][]>;
  /** Aviso normalizado + o JSON cru (versão corrigida por pacote). */
  osvAviso(id: string): Promise<{ aviso: AvisoNormalizado; bruto: unknown } | null>;
  kev(): Promise<EntradaKev[]>;
  epss(cves: string[]): Promise<Map<string, { score: number; percentil: number }>>;
}

const NVD = "https://services.nvd.nist.gov/rest/json";
const OSV = "https://api.osv.dev/v1";
const KEV = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json";
const EPSS = "https://api.first.org/data/v1/epss";
const TIMEOUT_MS = 30_000;
/** Teto de páginas do NVD por consulta (2.000 CVEs cada). */
const MAX_PAGINAS_NVD = 3;
/** O NVD exige janelas de no máximo 120 dias nos filtros de data. */
const JANELA_MAX_NVD_MS = 119 * 24 * 3600_000;
const LOTE_OSV = 1000;
const LOTE_EPSS = 100;

/** "2026-11-15T03:00:00.000" — o formato de data que a API 2.0 do NVD aceita (UTC, sem fuso). */
const dataNvd = (d: Date) => d.toISOString().replace("Z", "");

// Intervalo mínimo entre chamadas ao NVD, por processo (sincronização + busca da tela).
let proximaChamadaNvd = 0;

export class FontesPublicas implements FontesDeAvisos {
  private readonly intervaloNvdMs: number;

  constructor(
    private readonly nvdApiKey: string | null,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    this.intervaloNvdMs = nvdApiKey ? 700 : 6_500;
  }

  private async pegar(fonte: FonteIndisponivel["fonte"], url: string, init?: RequestInit): Promise<unknown> {
    let resposta: Response;
    try {
      resposta = await this.fetchImpl(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch (e) {
      throw new FonteIndisponivel(fonte, e instanceof Error && e.name === "TimeoutError" ? "não respondeu a tempo" : "falha de rede");
    }
    if (resposta.status === 404) return null;
    if (!resposta.ok) throw new FonteIndisponivel(fonte, `HTTP ${resposta.status}`);
    try {
      return await resposta.json();
    } catch {
      throw new FonteIndisponivel(fonte, "resposta não é JSON");
    }
  }

  private async nvd(url: string): Promise<unknown> {
    const espera = proximaChamadaNvd - Date.now();
    proximaChamadaNvd = Math.max(Date.now(), proximaChamadaNvd) + this.intervaloNvdMs;
    if (espera > 0) await new Promise((r) => setTimeout(r, espera));
    return this.pegar("NVD", url, this.nvdApiKey ? { headers: { apiKey: this.nvdApiKey } } : undefined);
  }

  private async nvdPaginado(base: string): Promise<RespostaNvd> {
    const avisos: AvisoNormalizado[] = [];
    const brutos: unknown[] = [];
    let inicio = 0;
    let truncado = false;
    for (let pagina = 0; pagina < MAX_PAGINAS_NVD; pagina++) {
      const json = await this.nvd(`${base}&resultsPerPage=2000&startIndex=${inicio}`);
      brutos.push(json);
      avisos.push(...avisosDoNvd(json));
      const { total, porPagina } = paginaDoNvd(json);
      inicio += porPagina;
      if (porPagina === 0 || inicio >= total) break;
      if (pagina === MAX_PAGINAS_NVD - 1) truncado = true;
    }
    // Junta as páginas num formato que `versaoCorrigidaNoNvd` lê.
    const vulnerabilities = brutos.flatMap((b) => (b as { vulnerabilities?: unknown[] })?.vulnerabilities ?? []);
    return { avisos, bruto: { vulnerabilities }, truncado };
  }

  async nvdPublicadas(desde: Date, ate: Date): Promise<RespostaNvd> {
    const inicio = new Date(Math.max(desde.getTime(), ate.getTime() - JANELA_MAX_NVD_MS));
    return this.nvdPaginado(`${NVD}/cves/2.0?noRejected&pubStartDate=${dataNvd(inicio)}&pubEndDate=${dataNvd(ate)}`);
  }

  async nvdPorProduto(cpe: string, modificadasDesde: Date | null, ate: Date): Promise<RespostaNvd> {
    let url = `${NVD}/cves/2.0?noRejected&virtualMatchString=${encodeURIComponent(cpe)}`;
    // Incremental só dentro da janela de 120 dias; fora dela, consulta completa.
    if (modificadasDesde && ate.getTime() - modificadasDesde.getTime() < JANELA_MAX_NVD_MS) {
      url += `&lastModStartDate=${dataNvd(modificadasDesde)}&lastModEndDate=${dataNvd(ate)}`;
    }
    return this.nvdPaginado(url);
  }

  async nvdBuscarProdutos(termo: string) {
    const json = await this.nvd(`${NVD}/cpes/2.0?keywordSearch=${encodeURIComponent(termo)}&resultsPerPage=200`);
    return produtosDoDicionarioCpe(json);
  }

  async osvLote(consultas: ConsultaOsv[]): Promise<string[][]> {
    const saida: string[][] = [];
    for (let i = 0; i < consultas.length; i += LOTE_OSV) {
      const lote = consultas.slice(i, i + LOTE_OSV).map((c) => ({
        package: { ecosystem: c.ecosystem, name: c.name },
        ...(c.version ? { version: c.version } : {}),
      }));
      const json = await this.pegar("OSV", `${OSV}/querybatch`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ queries: lote }),
      });
      saida.push(...idsDoOsvLote(json));
    }
    return saida;
  }

  async osvAviso(id: string) {
    const json = await this.pegar("OSV", `${OSV}/vulns/${encodeURIComponent(id)}`);
    const aviso = json ? avisoDoOsv(json) : null;
    return aviso ? { aviso, bruto: json } : null;
  }

  async kev(): Promise<EntradaKev[]> {
    return catalogoKev(await this.pegar("KEV", KEV));
  }

  async epss(cves: string[]) {
    const saida = new Map<string, { score: number; percentil: number }>();
    for (let i = 0; i < cves.length; i += LOTE_EPSS) {
      const json = await this.pegar("EPSS", `${EPSS}?cve=${cves.slice(i, i + LOTE_EPSS).join(",")}`);
      for (const [k, v] of notasEpss(json)) saida.set(k, v);
    }
    return saida;
  }
}
