/**
 * threat-intel.util.ts
 *
 * O QUE FAZ
 * As partes PURAS da Threat Intel (ADR-053): ler as respostas das fontes (NVD,
 * OSV, CISA KEV, FIRST EPSS), normalizar o inventário (purl → pacote, chave de
 * identidade, CPE) e decidir o que notifica. Sem rede e sem banco: tudo aqui é
 * testável com o JSON real das fontes, e o service só orquestra.
 *
 * POR QUE PURO
 * As fontes mudam de formato sem aviso (a API 2.0 do NVD ganhou `affected` em
 * 2026). Isolar a leitura num lugar só, com teste sobre amostra real, é o que
 * faz uma mudança dessas virar um teste vermelho em vez de dado errado na tela.
 */

import { calculateCvss } from "./cvss.util";
import { parseNvdLista } from "../services/sensors/nvd-cve.service";

// ============================================================================
// Vocabulário
// ============================================================================

/** Ecossistemas que o OSV entende, com o nome EXATO que ele espera. */
export const ECOSSISTEMAS = ["npm", "PyPI", "Maven", "Go", "NuGet", "RubyGems", "crates.io", "Packagist"] as const;
export type Ecossistema = (typeof ECOSSISTEMAS)[number];

/** Tipo do purl → ecossistema do OSV (https://github.com/package-url/purl-spec). */
const ECOSSISTEMA_DO_PURL: Record<string, Ecossistema> = {
  npm: "npm",
  pypi: "PyPI",
  maven: "Maven",
  golang: "Go",
  nuget: "NuGet",
  gem: "RubyGems",
  cargo: "crates.io",
  composer: "Packagist",
};

export const TIPOS_DE_ATIVO = ["PACKAGE", "PRODUCT"] as const;
export const PARTES_CPE = ["a", "o", "h"] as const;
export const STATUS_DE_ATIVO = ["SUGGESTED", "CONFIRMED", "DISMISSED"] as const;

export type Severidade = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "NONE";

/** Faixas oficiais do CVSS v3/v4. Sem nota → null (nunca inventa uma severidade). */
export function severidadeDaNota(nota: number | null | undefined): Severidade | null {
  if (nota === null || nota === undefined || Number.isNaN(nota)) return null;
  if (nota >= 9) return "CRITICAL";
  if (nota >= 7) return "HIGH";
  if (nota >= 4) return "MEDIUM";
  if (nota > 0) return "LOW";
  return "NONE";
}

// ============================================================================
// Inventário
// ============================================================================

export interface IdentidadeDoAtivo {
  // string, não união: as linhas do banco chegam como string; quem não é PACKAGE é tratado como PRODUCT.
  kind: string;
  ecosystem?: string | null;
  packageName?: string | null;
  cpePart?: string | null;
  cpeVendor?: string | null;
  cpeProduct?: string | null;
  version?: string | null;
}

/** "v1.2.3" e "1.2.3 " são a mesma versão; vazio é "sem versão". */
export function normalizarVersao(v: string | null | undefined): string | null {
  const t = (v ?? "").trim().replace(/^v(?=\d)/i, "");
  return t === "" || t === "*" || t === "-" ? null : t.slice(0, 64);
}

/**
 * Chave que impede a mesma tecnologia duas vezes na empresa (inclusive como
 * sugestão). Caixa baixa: "Lodash" e "lodash" são o mesmo pacote no npm, e o
 * CPE já é minúsculo por definição.
 */
export function chaveDeIdentidade(a: IdentidadeDoAtivo): string {
  const v = normalizarVersao(a.version) ?? "*";
  if (a.kind === "PACKAGE") return ["PACKAGE", a.ecosystem ?? "", a.packageName ?? "", v].join("|").toLowerCase();
  return ["PRODUCT", a.cpePart ?? "a", a.cpeVendor ?? "", a.cpeProduct ?? "", v].join("|").toLowerCase();
}

/** Nome para a tela: "lodash 4.17.15 (npm)" ou "f5 nginx 1.27.5". */
export function nomeDeExibicao(a: IdentidadeDoAtivo): string {
  const v = normalizarVersao(a.version);
  const base = a.kind === "PACKAGE" ? `${a.packageName} ${v ?? ""} (${a.ecosystem})` : `${a.cpeVendor} ${a.cpeProduct} ${v ?? ""}`;
  return base.replace(/\s+/g, " ").replace(" )", ")").trim().slice(0, 255);
}

/**
 * purl → pacote do OSV. Só os ecossistemas que o OSV cobre; o resto (deb, rpm,
 * apk, github...) volta null e simplesmente não vira sugestão.
 * "pkg:npm/%40angular/core@16.2.0" → { npm, "@angular/core", "16.2.0" }.
 */
export function pacoteDoPurl(purl: string | null | undefined): { ecosystem: Ecossistema; name: string; version: string | null } | null {
  const m = /^pkg:([a-z0-9.+-]+)\/([^@?#]+)(?:@([^?#]+))?/i.exec((purl ?? "").trim());
  if (!m) return null;
  const ecosystem = ECOSSISTEMA_DO_PURL[m[1]!.toLowerCase()];
  if (!ecosystem) return null;
  let name = decodeURIComponent(m[2]!);
  // Maven: namespace/nome → "namespace:nome", que é como o OSV identifica o artefato.
  if (ecosystem === "Maven") name = name.replace("/", ":");
  const version = m[3] ? normalizarVersao(decodeURIComponent(m[3])) : null;
  return { ecosystem, name: name.slice(0, 255), version };
}

/** A string que o NVD aceita em `virtualMatchString`. Sem versão = qualquer versão do produto. */
export function cpeDeBusca(a: IdentidadeDoAtivo): string {
  const v = normalizarVersao(a.version);
  return `cpe:2.3:${a.cpePart ?? "a"}:${a.cpeVendor}:${a.cpeProduct}${v ? `:${v}` : ""}`;
}

/**
 * Tecnologias que o fingerprint do DAST reconhece pelo nome → identidade no
 * inventário. Só o que tem correspondência inequívoca: um nome que não está
 * aqui não vira sugestão (melhor faltar do que sugerir o produto errado).
 */
const FINGERPRINT_PARA_ATIVO: Record<string, Omit<IdentidadeDoAtivo, "version">> = {
  nginx: { kind: "PRODUCT", cpePart: "a", cpeVendor: "f5", cpeProduct: "nginx" },
  apache: { kind: "PRODUCT", cpePart: "a", cpeVendor: "apache", cpeProduct: "http_server" },
  "apache-coyote": { kind: "PRODUCT", cpePart: "a", cpeVendor: "apache", cpeProduct: "tomcat" },
  php: { kind: "PRODUCT", cpePart: "a", cpeVendor: "php", cpeProduct: "php" },
  wordpress: { kind: "PRODUCT", cpePart: "a", cpeVendor: "wordpress", cpeProduct: "wordpress" },
  drupal: { kind: "PRODUCT", cpePart: "a", cpeVendor: "drupal", cpeProduct: "drupal" },
  "microsoft-iis": { kind: "PRODUCT", cpePart: "a", cpeVendor: "microsoft", cpeProduct: "internet_information_services" },
  openresty: { kind: "PRODUCT", cpePart: "a", cpeVendor: "openresty", cpeProduct: "openresty" },
  express: { kind: "PACKAGE", ecosystem: "npm", packageName: "express" },
  angular: { kind: "PACKAGE", ecosystem: "npm", packageName: "@angular/core" },
  "next.js": { kind: "PACKAGE", ecosystem: "npm", packageName: "next" },
  nuxt: { kind: "PACKAGE", ecosystem: "npm", packageName: "nuxt" },
};

/** Tecnologia do fingerprint (nome + versão) → identidade; null se não há correspondência segura. */
export function ativoDoFingerprint(nome: string, versao: string | null): IdentidadeDoAtivo | null {
  const base = FINGERPRINT_PARA_ATIVO[nome.trim().toLowerCase()];
  return base ? { ...base, version: normalizarVersao(versao) } : null;
}

/** CPE 2.2 da InternetDB ("cpe:/a:apache:http_server:2.4.49") → identidade de produto. */
export function ativoDoCpe22(cpe: string): IdentidadeDoAtivo | null {
  const m = /^cpe:\/([aoh]):([^:]+):([^:]+)(?::([^:]+))?/i.exec(cpe.trim());
  if (!m) return null;
  return { kind: "PRODUCT", cpePart: m[1]!.toLowerCase(), cpeVendor: m[2]!.toLowerCase(), cpeProduct: m[3]!.toLowerCase(), version: normalizarVersao(m[4]) };
}

// ============================================================================
// Avisos (o que as fontes devolvem, já no formato do ThreatAdvisory)
// ============================================================================

export interface AvisoNormalizado {
  id: string;
  aliases: string[];
  source: "NVD" | "OSV" | "KEV";
  title: string | null;
  description: string | null;
  cvssScore: number | null;
  cvssVersion: string | null;
  cvssVector: string | null;
  severity: Severidade | null;
  cweId: string | null;
  publishedAt: Date | null;
  modifiedAt: Date | null;
  references: string[];
}

const data = (v: unknown): Date | null => {
  if (typeof v !== "string" || !v) return null;
  // O NVD manda "2026-11-13T00:20:09.977" sem fuso: é UTC.
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(v) ? v : `${v}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
};
const texto = (v: unknown, max: number): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

/** Primeira frase da descrição como título (o NVD não tem título; o OSV às vezes não tem resumo). */
export function tituloDaDescricao(desc: string | null): string | null {
  if (!desc) return null;
  const frase = desc.split(/(?<=[.!?])\s/)[0] ?? desc;
  return frase.length > 160 ? `${frase.slice(0, 157)}...` : frase;
}

interface NvdBruto {
  vulnerabilities?: { cve?: { id?: string; lastModified?: string; configurations?: NvdConfig[] } }[];
  totalResults?: number;
  resultsPerPage?: number;
  startIndex?: number;
}
interface NvdConfig {
  nodes?: { cpeMatch?: { vulnerable?: boolean; criteria?: string; versionEndExcluding?: string }[] }[];
}

/** Resposta da API 2.0 de CVEs → avisos. Reaproveita o parser do sensor do DAST (mesma fonte). */
export function avisosDoNvd(json: unknown): AvisoNormalizado[] {
  const bruto = json as NvdBruto;
  const modificados = new Map((bruto?.vulnerabilities ?? []).flatMap((v) => (v.cve?.id ? [[v.cve.id, v.cve.lastModified] as const] : [])));
  return [...parseNvdLista(json).values()].map((c) => ({
    id: c.id,
    aliases: [],
    source: "NVD" as const,
    title: tituloDaDescricao(c.description),
    description: c.description?.slice(0, 8000) ?? null,
    cvssScore: c.cvssScore,
    cvssVersion: c.cvssVersion,
    cvssVector: c.cvssVector,
    severity: severidadeDaNota(c.cvssScore),
    cweId: c.cweId,
    publishedAt: c.publishedAt,
    modifiedAt: data(modificados.get(c.id)),
    references: c.references,
  }));
}

/** Total e página da resposta do NVD, para paginar. */
export function paginaDoNvd(json: unknown): { total: number; porPagina: number; inicio: number } {
  const b = json as NvdBruto;
  return { total: b?.totalResults ?? 0, porPagina: b?.resultsPerPage ?? 0, inicio: b?.startIndex ?? 0 };
}

/**
 * Versão corrigida que o NVD declara para o produto (`versionEndExcluding` do
 * cpeMatch vulnerável daquele fabricante:produto). null quando o NVD não diz.
 */
export function versaoCorrigidaNoNvd(json: unknown, cveId: string, vendor: string, product: string): string | null {
  const cve = (json as NvdBruto)?.vulnerabilities?.find((v) => v.cve?.id === cveId)?.cve;
  const prefixo = `:${vendor}:${product}:`.toLowerCase();
  for (const conf of cve?.configurations ?? []) {
    for (const node of conf.nodes ?? []) {
      for (const m of node.cpeMatch ?? []) {
        if (m.vulnerable && m.criteria?.toLowerCase().includes(prefixo) && m.versionEndExcluding) return m.versionEndExcluding.slice(0, 128);
      }
    }
  }
  return null;
}

/** Produtos da API de CPEs do NVD → opções da busca do inventário (uma por fabricante:produto). */
export function produtosDoDicionarioCpe(json: unknown): { cpePart: string; cpeVendor: string; cpeProduct: string; titulo: string; exemplo: string }[] {
  const produtos = (json as { products?: { cpe?: { cpeName?: string; deprecated?: boolean; titles?: { title: string; lang: string }[] } }[] })?.products ?? [];
  const vistos = new Map<string, { cpePart: string; cpeVendor: string; cpeProduct: string; titulo: string; exemplo: string }>();
  for (const p of produtos) {
    const nome = p.cpe?.cpeName;
    if (!nome || p.cpe?.deprecated) continue;
    const [, , parte, fornecedor, produto] = nome.split(":");
    if (!parte || !fornecedor || !produto) continue;
    const chave = `${parte}:${fornecedor}:${produto}`;
    if (vistos.has(chave)) continue;
    const titulo = p.cpe?.titles?.find((t) => t.lang === "en")?.title ?? `${fornecedor} ${produto}`;
    vistos.set(chave, { cpePart: parte, cpeVendor: fornecedor, cpeProduct: produto, titulo: titulo.replace(/\s+\S*\d[\w.-]*$/, "").slice(0, 200), exemplo: nome });
  }
  return [...vistos.values()];
}

/** Resposta do `querybatch` do OSV → ids de aviso por consulta (mesma ordem das consultas). */
export function idsDoOsvLote(json: unknown): string[][] {
  const r = (json as { results?: { vulns?: { id?: string }[] }[] })?.results ?? [];
  return r.map((x) => (x.vulns ?? []).flatMap((v) => (typeof v.id === "string" ? [v.id] : [])));
}

interface OsvBruto {
  id?: string;
  summary?: string;
  details?: string;
  aliases?: string[];
  published?: string;
  modified?: string;
  severity?: { type?: string; score?: string }[];
  database_specific?: { severity?: string; cwe_ids?: string[] };
  references?: { url?: string }[];
  affected?: { package?: { ecosystem?: string; name?: string }; ranges?: { events?: Record<string, string>[] }[] }[];
}

const SEVERIDADE_GHSA: Record<string, Severidade> = { CRITICAL: "CRITICAL", HIGH: "HIGH", MODERATE: "MEDIUM", MEDIUM: "MEDIUM", LOW: "LOW" };

/**
 * Um aviso do OSV → aviso normalizado. O id passa a ser a CVE quando existe
 * (`aliases`), para casar com o NVD, o KEV e o EPSS; o id do OSV fica nos aliases.
 * A nota vem do vetor CVSS 3.x calculado aqui (mesma calculadora do produto);
 * sem vetor 3.x, fica a severidade declarada pelo GitHub, sem inventar nota.
 */
export function avisoDoOsv(json: unknown): AvisoNormalizado | null {
  const o = json as OsvBruto;
  if (!o?.id) return null;
  const cve = (o.aliases ?? []).find((a) => /^CVE-\d{4}-\d{4,}$/.test(a));
  const vetor = o.severity?.find((s) => s.type === "CVSS_V3" && typeof s.score === "string")?.score ?? null;
  let nota: number | null = null;
  if (vetor) {
    try {
      nota = calculateCvss(vetor).score;
    } catch {
      nota = null;
    }
  }
  const cwe = o.database_specific?.cwe_ids?.find((c) => /^CWE-\d+$/.test(c));
  return {
    id: (cve ?? o.id).slice(0, 64),
    aliases: [...new Set([o.id, ...(o.aliases ?? [])])].filter((a) => a !== (cve ?? o.id)).slice(0, 20),
    source: "OSV",
    title: texto(o.summary, 500) ?? tituloDaDescricao(texto(o.details, 8000)),
    description: texto(o.details, 8000),
    cvssScore: nota,
    cvssVersion: vetor ? (vetor.startsWith("CVSS:3.0") ? "3.0" : "3.1") : null,
    cvssVector: vetor?.slice(0, 255) ?? null,
    severity: nota !== null ? severidadeDaNota(nota) : (SEVERIDADE_GHSA[(o.database_specific?.severity ?? "").toUpperCase()] ?? null),
    cweId: cwe ? cwe.replace("CWE-", "") : null,
    publishedAt: data(o.published),
    modifiedAt: data(o.modified),
    references: (o.references ?? []).flatMap((r) => (typeof r.url === "string" ? [r.url] : [])).slice(0, 5),
  };
}

/** Compara versões por segmentos numéricos ("1.10.0" > "1.9.2"); sufixos não numéricos contam como 0. */
export function compararVersoes(a: string, b: string): number {
  const pa = a.split(/[.+-]/).map((x) => parseInt(x, 10) || 0);
  const pb = b.split(/[.+-]/).map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/**
 * A menor versão corrigida MAIOR que a versão em uso, para aquele pacote — num
 * aviso com várias linhas (4.x e 5.x), é a correção da linha da pessoa.
 * Sem versão em uso, a menor corrigida. null se o aviso não declara correção.
 */
export function versaoCorrigidaNoOsv(json: unknown, ecosystem: string, name: string, versaoEmUso: string | null): string | null {
  const o = json as OsvBruto;
  const corrigidas = (o?.affected ?? [])
    .filter((a) => a.package?.ecosystem === ecosystem && a.package?.name?.toLowerCase() === name.toLowerCase())
    .flatMap((a) => a.ranges ?? [])
    .flatMap((r) => r.events ?? [])
    .flatMap((e) => (typeof e.fixed === "string" ? [e.fixed] : []))
    .sort(compararVersoes);
  if (corrigidas.length === 0) return null;
  const acima = versaoEmUso ? corrigidas.filter((f) => compararVersoes(f, versaoEmUso) > 0) : corrigidas;
  return (acima[0] ?? null)?.slice(0, 128) ?? null;
}

export interface EntradaKev {
  cveId: string;
  nome: string | null;
  descricao: string | null;
  adicionadaEm: Date | null;
  prazo: Date | null;
  ransomware: boolean;
}

/** Catálogo da CISA → entradas. Datas "AAAA-MM-DD" como meia-noite UTC. */
export function catalogoKev(json: unknown): EntradaKev[] {
  const lista = (json as { vulnerabilities?: Record<string, unknown>[] })?.vulnerabilities ?? [];
  return lista.flatMap((v) => {
    const id = typeof v.cveID === "string" ? v.cveID.trim() : "";
    if (!/^CVE-\d{4}-\d{4,}$/.test(id)) return [];
    return [
      {
        cveId: id,
        nome: texto(v.vulnerabilityName, 500),
        descricao: texto(v.shortDescription, 8000),
        adicionadaEm: data(typeof v.dateAdded === "string" ? `${v.dateAdded}T00:00:00Z` : null),
        prazo: data(typeof v.dueDate === "string" ? `${v.dueDate}T00:00:00Z` : null),
        ransomware: String(v.knownRansomwareCampaignUse ?? "").toLowerCase() === "known",
      },
    ];
  });
}

/** Resposta da API do EPSS → probabilidade e percentil por CVE. */
export function notasEpss(json: unknown): Map<string, { score: number; percentil: number }> {
  const dados = (json as { data?: { cve?: string; epss?: string; percentile?: string }[] })?.data ?? [];
  return new Map(
    dados.flatMap((d) => {
      const score = Number(d.epss);
      const percentil = Number(d.percentile);
      return d.cve && Number.isFinite(score) && Number.isFinite(percentil) ? [[d.cve, { score, percentil }] as const] : [];
    }),
  );
}

// ============================================================================
// O que notifica (D19.6 e D19.7)
// ============================================================================

export interface EventoCandidato {
  matchId: string;
  companyId: string;
  advisoryId: string;
  titulo: string | null;
  ativo: string;
  cvssScore: number | null;
  kev: boolean;
  /** Publicada antes de a tecnologia entrar no inventário. */
  preexisting: boolean;
  /** A CVE entrou no KEV depois de a tecnologia entrar no inventário, e isso ainda não foi avisado. */
  kevNovo: boolean;
  jaNotificada: boolean;
  versionConfirmed: boolean;
}

/** Nota mínima que notifica sem KEV (D19.6: CVSS ≥ 7 ou KEV). */
export const NOTA_QUE_NOTIFICA = 7;
/** Acima disto, por empresa e execução, vira um resumo só (não uma enxurrada no sino). */
export const MAX_NOTIFICACOES_INDIVIDUAIS = 3;

/**
 * Decide o que vira notificação. Regras:
 *  - CVE nova no inventário: só se NÃO for pré-existente (D19.7) e tiver
 *    CVSS ≥ 7 ou estiver no KEV (D19.6);
 *  - CVE já conhecida que ENTROU no KEV depois do mapeamento: notifica mesmo
 *    pré-existente — exploração ativa é um fato novo;
 *  - cada evento uma vez só (`jaNotificada` / `kevNovo`).
 */
export function eventosQueNotificam(candidatos: EventoCandidato[]): EventoCandidato[] {
  return candidatos.filter((c) => {
    if (c.kevNovo) return true;
    if (c.jaNotificada || c.preexisting) return false;
    return c.kev || (c.cvssScore ?? 0) >= NOTA_QUE_NOTIFICA;
  });
}
