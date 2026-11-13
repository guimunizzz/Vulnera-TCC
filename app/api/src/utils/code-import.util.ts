/**
 * code-import.util.ts
 *
 * O QUE FAZ
 * Lê o relatório que uma ferramenta de análise de CÓDIGO já gerou na pipeline
 * do cliente e devolve uma lista normalizada de achados. Dois formatos:
 *
 *  - SARIF 2.1.0 (OASIS) — o formato comum de SAST: Semgrep, CodeQL,
 *    SonarQube, Bandit, ESLint, e também Trivy/Grype quando exportam SARIF.
 *  - CycloneDX (1.4+) com a seção `vulnerabilities` — SBOM com as CVEs dos
 *    componentes (SCA): `trivy fs --format cyclonedx --scanners vuln`, Grype.
 *
 * POR QUE É PURO (sem Prisma, sem Express)
 * O parser recebe texto e devolve dados. Isso deixa o service só com a regra
 * de negócio (dono, dedup entre importações, herança de triagem) e permite
 * testar o parser contra relatórios reais sem banco nem HTTP.
 *
 * SEGURANÇA
 * O arquivo vem do usuário. O parser só LÊ campos conhecidos de um JSON.parse
 * (nada é executado nem mesclado em objeto existente), corta todo texto livre
 * num tamanho máximo e recusa relatórios com achados demais em vez de
 * truncar em silêncio (truncar esconderia achados — mesma regra do export).
 *
 * FINGERPRINT
 * É o que permite dizer, numa reimportação, "este achado já existia". Por isso
 * ele NÃO usa a linha quando a ferramenta fornece um fingerprint estável
 * (SARIF `fingerprints`/`partialFingerprints`): uma linha em branco inserida
 * acima do problema não pode transformá-lo em "achado novo".
 */

import { createHash } from "crypto";

export type CodeSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
export type CodeCategory = "SAST" | "SCA";
export type CodeReportFormat = "SARIF" | "CYCLONEDX";

export const CODE_SEVERITY_ORDER: Record<CodeSeverity, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4 };

/** Teto de achados por arquivo. Acima disso a importação é recusada (IMPORT_TOO_LARGE), nunca truncada. */
export const MAX_FINDINGS_PER_IMPORT = 5000;

export interface ParsedCodeFinding {
  fingerprint: string;
  category: CodeCategory;
  ruleId: string;
  title: string;
  severity: CodeSeverity;
  cweId: string | null;
  filePath: string | null;
  startLine: number | null;
  endLine: number | null;
  snippet: string | null;
  packageName: string | null;
  packageVersion: string | null;
  purl: string | null;
  fixedVersion: string | null;
  advisoryId: string | null;
  cvssScore: number | null;
  cvssVector: string | null;
  description: string | null;
  recommendation: string | null;
  helpUri: string | null;
}

export interface ParsedCodeReport {
  format: CodeReportFormat;
  toolName: string;
  toolVersion: string | null;
  findings: ParsedCodeFinding[];
  componentsCount: number | null;
  warnings: string[];
}

// ============================================================================
// Helpers
// ============================================================================

type Json = Record<string, unknown>;

function isObj(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function arr(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** Texto livre do relatório, aparado e cortado. `null` se vazio ou não-string. */
function str(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  if (!t) return null;
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function int(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

function sha256(...parts: Array<string | null | undefined>): string {
  return createHash("sha256").update(parts.map((p) => p ?? "").join("|")).digest("hex");
}

/** Faixas de severidade do CVSS v3 (FIRST) — as mesmas que GitHub/CodeQL usam para `security-severity`. */
export function severityFromScore(score: number): CodeSeverity {
  if (score >= 9) return "CRITICAL";
  if (score >= 7) return "HIGH";
  if (score >= 4) return "MEDIUM";
  if (score > 0) return "LOW";
  return "INFO";
}

/** "CWE-79", "external/cwe/cwe-079", "CWE-79: Improper..." → "79". */
export function extractCwe(values: unknown[]): string | null {
  for (const v of values) {
    const raw = typeof v === "number" ? `CWE-${v}` : typeof v === "string" ? v : "";
    const m = /cwe[-_/: ]?0*(\d{1,5})/i.exec(raw);
    if (m) return m[1];
  }
  return null;
}

const ADVISORY_RE = /^(CVE-\d{4}-\d{4,}|GHSA(-[0-9a-z]{4}){3}|GO-\d{4}-\d+|PYSEC-\d{4}-\d+|RUSTSEC-\d{4}-\d+|OSV-[\w-]+|NSWG-ECO-\d+)$/i;

/**
 * Valores que ferramentas gravam no campo de fingerprint sem que sejam um
 * fingerprint. O Semgrep OSS sem login escreve literalmente "requires login"
 * em `matchBasedId/v1` — achado ao importar um relatório real em 2026-11-13:
 * sem este filtro, todas as ocorrências de uma regra num arquivo viravam um
 * achado só.
 */
const FINGERPRINT_PLACEHOLDER = /^requires login$/i;

/**
 * Linhas de propaganda que ferramentas anexam à ajuda da regra. Vistas no
 * Semgrep OSS real (2026-11-13): "Enable cross-file analysis and Pro rules for
 * free at sg.run/pro".
 */
const LINHA_PROMOCIONAL = /sg\.run\/pro|enable cross-file analysis/i;

/**
 * Ajuda da regra como recomendação: texto puro (a tela não renderiza
 * markdown/HTML), sem propaganda, e descartada se só repete a descrição —
 * o Semgrep grava em `help.text` a própria descrição + a linha promocional.
 */
function limparAjuda(texto: string | null, jaExibidos: Array<string | null>): string | null {
  if (!texto) return null;
  const limpo = texto
    .split("\n")
    .filter((linha) => !LINHA_PROMOCIONAL.test(linha))
    .join("\n")
    .trim();
  if (!limpo) return null;
  return jaExibidos.some((t) => t && t.trim() === limpo) ? null : limpo;
}

/** 1ª frase da mensagem, curta o bastante para título (mensagens de Semgrep são parágrafos). */
function primeiraFrase(message: string | null): string | null {
  if (!message) return null;
  const linha = message.split("\n")[0];
  const fim = linha.search(/\.\s/);
  return str(fim > 0 && fim < 200 ? linha.slice(0, fim + 1) : linha, 200);
}

type PendenteSarif = { finding: Omit<ParsedCodeFinding, "fingerprint">; tool: string; stable: string | null; scaKey: string | null };

/**
 * Caminho do arquivo como a ferramenta reportou, sem o prefixo `file://` e
 * sem `./`. Nunca é usado para abrir arquivo — só exibido e usado no
 * fingerprint —, mas mesmo assim é cortado num tamanho sensato.
 */
function cleanPath(uri: unknown): string | null {
  const raw = str(uri, 1000);
  if (!raw) return null;
  let p = raw.replace(/^file:\/\/\/?/i, "");
  try {
    p = decodeURIComponent(p);
  } catch {
    // URI malformada: fica como veio
  }
  return p.replace(/^\.\//, "");
}

// ============================================================================
// Detecção
// ============================================================================

export function parseCodeReport(rawText: string): ParsedCodeReport {
  let doc: unknown;
  try {
    // BOM UTF-8 no começo é comum em arquivos gerados no Windows
    doc = JSON.parse(rawText.charCodeAt(0) === 0xfeff ? rawText.slice(1) : rawText);
  } catch {
    throw new Error("INVALID_FILE_FORMAT");
  }
  if (!isObj(doc)) throw new Error("INVALID_FILE_FORMAT");

  let report: ParsedCodeReport;
  if (Array.isArray(doc.runs)) report = parseSarif(doc);
  else if (doc.bomFormat === "CycloneDX") report = parseCycloneDx(doc);
  else throw new Error("UNSUPPORTED_REPORT_FORMAT");

  if (report.findings.length > MAX_FINDINGS_PER_IMPORT) throw new Error("IMPORT_TOO_LARGE");
  return report;
}

/** Remove fingerprints repetidos dentro do MESMO arquivo (ex.: a mesma CVE listada duas vezes). */
function dedupe(findings: ParsedCodeFinding[], warnings: string[]): ParsedCodeFinding[] {
  const seen = new Set<string>();
  const out: ParsedCodeFinding[] = [];
  for (const f of findings) {
    if (seen.has(f.fingerprint)) continue;
    seen.add(f.fingerprint);
    out.push(f);
  }
  const removidos = findings.length - out.length;
  if (removidos > 0) warnings.push(`${removidos} ocorrência(s) repetida(s) no próprio arquivo foram agrupadas.`);
  return out;
}

// ============================================================================
// SARIF 2.1.0
// ============================================================================

const LEVEL_SEVERITY: Record<string, CodeSeverity> = { error: "HIGH", warning: "MEDIUM", note: "LOW", none: "INFO" };

/**
 * O Trivy escreve os dados do pacote no texto da mensagem SARIF
 * ("Package: lodash\nInstalled Version: 4.17.15\n...Fixed Version: 4.17.21").
 * Ler daqui é melhor que deixar a linha sem pacote — e, se o formato mudar,
 * os campos ficam nulos e o achado continua importado.
 */
function lerCampoDaMensagem(message: string | null, rotulo: string): string | null {
  if (!message) return null;
  const m = new RegExp(`^${rotulo}:\\s*(.+)$`, "im").exec(message);
  return m ? str(m[1], 255) : null;
}

function parseSarif(doc: Json): ParsedCodeReport {
  if (doc.version !== undefined && doc.version !== "2.1.0") throw new Error("UNSUPPORTED_SARIF_VERSION");

  const warnings: string[] = [];
  // 1ª passada junta os achados com a chave candidata; o fingerprint só é
  // fechado na 2ª, quando dá para saber se o fingerprint da ferramenta
  // distingue mesmo as ocorrências.
  const pendentes: PendenteSarif[] = [];
  const toolNames: string[] = [];
  let toolVersion: string | null = null;
  let semLocalizacao = 0;

  for (const run of arr(doc.runs)) {
    if (!isObj(run)) continue;
    const driver = isObj(run.tool) && isObj(run.tool.driver) ? run.tool.driver : {};
    const toolName = str(driver.name, 100) ?? "SARIF";
    if (!toolNames.includes(toolName)) toolNames.push(toolName);
    toolVersion ??= str(driver.semanticVersion, 64) ?? str(driver.version, 64);

    // Regras do driver + das extensões (CodeQL publica as queries em extensions).
    const rules = [driver, ...arr(isObj(run.tool) ? run.tool.extensions : [])]
      .filter(isObj)
      .flatMap((component) => arr(component.rules))
      .filter(isObj);
    const driverRules = arr(driver.rules).filter(isObj);
    const ruleById = new Map<string, Json>();
    for (const r of rules) if (typeof r.id === "string" && !ruleById.has(r.id)) ruleById.set(r.id, r);

    for (const result of arr(run.results)) {
      if (!isObj(result)) continue;
      // Achado suprimido na origem (// nosemgrep, alert dismissal) não entra.
      if (arr(result.suppressions).some((s) => isObj(s) && s.status !== "rejected")) continue;

      const ruleRef = isObj(result.rule) ? result.rule : {};
      const ruleId =
        str(result.ruleId, 255) ?? str(ruleRef.id, 255) ?? (typeof result.ruleIndex === "number" ? str(driverRules[result.ruleIndex]?.id, 255) : null) ?? "regra-desconhecida";
      const rule =
        ruleById.get(ruleId) ?? (typeof result.ruleIndex === "number" && driverRules[result.ruleIndex] ? driverRules[result.ruleIndex] : {});
      const ruleProps = isObj(rule.properties) ? rule.properties : {};
      const resultProps = isObj(result.properties) ? result.properties : {};

      const message = isObj(result.message) ? str(result.message.text, 8000) : null;
      const shortDesc = isObj(rule.shortDescription) ? str(rule.shortDescription.text, 500) : null;
      const fullDesc = isObj(rule.fullDescription) ? str(rule.fullDescription.text, 8000) : null;

      // Severidade: `security-severity` (0–10, padrão GitHub/CodeQL/Trivy) é
      // mais preciso que o `level`; o level fica de fallback.
      const securitySeverity = Number.parseFloat(String(resultProps["security-severity"] ?? ruleProps["security-severity"] ?? ""));
      const level =
        str(result.level, 16) ??
        (isObj(rule.defaultConfiguration) ? str(rule.defaultConfiguration.level, 16) : null) ??
        "warning";
      const severity = Number.isFinite(securitySeverity) ? severityFromScore(securitySeverity) : (LEVEL_SEVERITY[level] ?? "MEDIUM");

      const loc = arr(result.locations).find(isObj);
      const physical = loc && isObj(loc.physicalLocation) ? loc.physicalLocation : null;
      const region = physical && isObj(physical.region) ? physical.region : {};
      const filePath = physical && isObj(physical.artifactLocation) ? cleanPath(physical.artifactLocation.uri) : null;
      const startLine = int(region.startLine);
      const endLine = int(region.endLine) ?? startLine;
      const snippet = isObj(region.snippet) ? str(region.snippet.text, 2000) : null;
      if (!filePath) semLocalizacao++;

      // SCA: id de advisory na regra, ou o bloco "Installed Version:" que o
      // Trivy escreve na mensagem (cobre ids fora do padrão, ex.: NSWG-ECO-*).
      const installed = lerCampoDaMensagem(message, "Installed Version");
      const isSca = ADVISORY_RE.test(ruleId) || installed !== null;
      const packageName = isSca ? lerCampoDaMensagem(message, "Package") : null;
      const packageVersion = isSca ? installed : null;
      const fixedVersion = isSca ? lerCampoDaMensagem(message, "Fixed Version") : null;

      const stable =
        [result.fingerprints, result.partialFingerprints]
          .filter(isObj)
          .flatMap((o) => Object.keys(o).sort().map((k) => o[k]))
          .find((v): v is string => typeof v === "string" && v.length > 0 && !FINGERPRINT_PLACEHOLDER.test(v)) ?? null;

      // Título: a descrição curta da regra, quando diz algo (o Semgrep grava
      // "Semgrep Finding: <id>"); o nome da regra, se não for o próprio id;
      // senão a 1ª frase da mensagem.
      const shortUtil = shortDesc && !/finding:/i.test(shortDesc) ? shortDesc : null;
      const nome = str(rule.name, 500);
      const nomeUtil = nome && nome !== ruleId ? nome : null;
      const title = str(shortUtil ?? nomeUtil ?? primeiraFrase(message) ?? ruleId, 500)!;

      const helpText = limparAjuda(isObj(rule.help) ? (str(rule.help.text, 10000) ?? str(rule.help.markdown, 10000)) : null, [message, fullDesc]);
      const description = [message, fullDesc && fullDesc !== message ? fullDesc : null].filter(Boolean).join("\n\n") || null;

      pendentes.push({
        tool: toolName,
        stable,
        scaKey: isSca && packageName ? `${packageName}@${packageVersion}` : null,
        finding: {
        category: isSca ? "SCA" : "SAST",
        ruleId,
        title,
        severity,
        cweId: extractCwe([...arr(ruleProps.tags), ...arr(resultProps.tags), ...arr(ruleProps.cwe)]),
        filePath,
        startLine,
        endLine,
        snippet,
        packageName,
        packageVersion,
        purl: null,
        fixedVersion,
        advisoryId: isSca ? ruleId.toUpperCase() : null,
        cvssScore: Number.isFinite(securitySeverity) ? securitySeverity : null,
        cvssVector: null,
        description,
        recommendation: helpText,
        helpUri: str(rule.helpUri, 2000),
        },
      });
    }
  }

  if (toolNames.length === 0) throw new Error("INVALID_FILE_FORMAT");
  if (semLocalizacao > 0) warnings.push(`${semLocalizacao} resultado(s) sem localização no código.`);

  return {
    format: "SARIF",
    toolName: str(toolNames.join(" + "), 100)!,
    toolVersion,
    findings: fecharFingerprintsSarif(pendentes),
    componentsCount: null,
    warnings,
  };
}

/**
 * 2ª passada do SARIF. Regras do fingerprint, em ordem:
 *  1. SCA com pacote: ferramenta | regra | arquivo | pacote@versão.
 *  2. SAST com fingerprint da ferramenta que DISTINGUE: ele vence a linha —
 *     inserir uma linha acima do problema não pode criar um "achado novo".
 *     Só distingue se, para a mesma regra+arquivo, não aparece em linhas
 *     diferentes (o "requires login" e ferramentas que hasheiam só o trecho,
 *     igual em linhas repetidas).
 *  3. Senão, a linha.
 * Colisão que sobra (duas ocorrências na mesma linha) recebe o número da
 * ocorrência: a ordem é a do relatório, estável entre execuções da ferramenta.
 */
function fecharFingerprintsSarif(pendentes: PendenteSarif[]): ParsedCodeFinding[] {
  const grupo = (p: PendenteSarif) => `${p.tool}|${p.finding.ruleId}|${p.finding.filePath ?? ""}|${p.stable}`;
  const linhasPorStable = new Map<string, Set<number | null>>();
  for (const p of pendentes) {
    if (!p.stable) continue;
    const linhas = linhasPorStable.get(grupo(p)) ?? new Set<number | null>();
    linhas.add(p.finding.startLine);
    linhasPorStable.set(grupo(p), linhas);
  }

  const ocorrencias = new Map<string, number>();
  return pendentes.map((p) => {
    const distingue = p.stable !== null && (linhasPorStable.get(grupo(p))?.size ?? 0) <= 1;
    const chave = p.scaKey ?? (distingue ? `fp:${p.stable}` : `L${p.finding.startLine ?? ""}`);
    const base = `${p.tool}|${p.finding.ruleId}|${p.finding.filePath ?? ""}|${chave}`;
    const n = (ocorrencias.get(base) ?? 0) + 1;
    ocorrencias.set(base, n);
    return { ...p.finding, fingerprint: sha256("sarif", base, n > 1 ? `#${n}` : null) };
  });
}

// ============================================================================
// CycloneDX (SBOM + vulnerabilities)
// ============================================================================

const CDX_SEVERITY: Record<string, CodeSeverity> = {
  critical: "CRITICAL",
  high: "HIGH",
  medium: "MEDIUM",
  moderate: "MEDIUM",
  low: "LOW",
  info: "INFO",
  none: "INFO",
};

interface CdxComponent {
  name: string;
  version: string | null;
  purl: string | null;
}

function flattenComponents(list: unknown[], into: Map<string, CdxComponent>, counter: { n: number }): void {
  for (const c of list) {
    if (!isObj(c)) continue;
    counter.n++;
    const group = str(c.group, 200);
    const name = str(c.name, 300);
    const comp: CdxComponent = {
      name: str(group ? `${group}/${name}` : name, 500) ?? "componente-sem-nome",
      version: str(c.version, 128),
      purl: str(c.purl, 2000),
    };
    const ref = str(c["bom-ref"], 2000) ?? comp.purl;
    if (ref) into.set(ref, comp);
    flattenComponents(arr(c.components), into, counter);
  }
}

/** CycloneDX ≤1.4: `tools` é array; ≥1.5: `tools.components`/`tools.services`. */
function cdxTool(metadata: Json): { name: string; version: string | null } {
  const tools = metadata.tools;
  const list = Array.isArray(tools) ? tools : isObj(tools) ? [...arr(tools.components), ...arr(tools.services)] : [];
  const first = list.find(isObj);
  if (!first) return { name: "CycloneDX", version: null };
  return { name: str(first.name, 100) ?? "CycloneDX", version: str(first.version, 64) };
}

/**
 * Versão sem a falha: CycloneDX tem o campo certo (`affects[].versions` com
 * status "unaffected"), mas o Trivy só escreve no texto da recomendação
 * ("Upgrade uglify-js to version >=2.6.0").
 * shortcut: o texto do Trivy é lido por regex; se mudar, o campo fica nulo e a
 * recomendação continua exibida inteira.
 */
function versaoCorrigida(affect: Json | undefined, recommendation: string | null): string | null {
  const unaffected = arr(affect?.versions)
    .filter(isObj)
    .filter((v) => v.status === "unaffected")
    .map((v) => str(v.version, 128) ?? str(v.range, 255))
    .filter((v): v is string => !!v);
  if (unaffected.length > 0) return str(unaffected.join(", "), 255);
  const m = recommendation ? /to version\s+(.+)$/im.exec(recommendation) : null;
  return m ? str(m[1], 255) : null;
}

function parseCycloneDx(doc: Json): ParsedCodeReport {
  const warnings: string[] = [];
  const metadata = isObj(doc.metadata) ? doc.metadata : {};
  const tool = cdxTool(metadata);

  const components = new Map<string, CdxComponent>();
  const counter = { n: 0 };
  flattenComponents(arr(doc.components), components, counter);

  const vulns = arr(doc.vulnerabilities).filter(isObj);
  if (!Array.isArray(doc.vulnerabilities)) {
    warnings.push(
      "O SBOM não traz a seção `vulnerabilities`: só a lista de componentes foi lida. Gere com um scanner de vulnerabilidades (ex.: `trivy fs --format cyclonedx --scanners vuln`).",
    );
  }

  const findings: ParsedCodeFinding[] = [];
  for (const v of vulns) {
    const id = str(v.id, 64) ?? "vulnerabilidade-sem-id";
    const ratings = arr(v.ratings).filter(isObj);

    // A maior severidade entre as fontes (NVD, GHSA, distro...) — conservador.
    let severity: CodeSeverity | null = null;
    let score: number | null = null;
    let vector: string | null = null;
    // v3.1 antes de v3.0: o mesmo SBOM do Trivy traz as duas (NVD/GHSA).
    const porVersao = [...ratings].sort((a, b) => Number(b.method === "CVSSv31") - Number(a.method === "CVSSv31"));
    for (const r of porVersao) {
      const s = typeof r.severity === "string" ? CDX_SEVERITY[r.severity.toLowerCase()] : undefined;
      const sc = typeof r.score === "number" && Number.isFinite(r.score) ? r.score : null;
      const sev = s ?? (sc !== null ? severityFromScore(sc) : undefined);
      if (sev && (severity === null || CODE_SEVERITY_ORDER[sev] < CODE_SEVERITY_ORDER[severity])) severity = sev;
      if (sc !== null && (score === null || sc > score)) score = sc;
      const method = typeof r.method === "string" ? r.method : "";
      const vec = str(r.vector, 255);
      // Só v3.x: é o que o Vulnera calcula (RN10). Sem prefixo, a versão vem do `method`.
      if (!vector && vec && /^CVSSv3/i.test(method)) {
        vector = vec.startsWith("CVSS:") ? vec : `CVSS:${method === "CVSSv31" ? "3.1" : "3.0"}/${vec}`;
      }
    }

    const affects = arr(v.affects).filter(isObj);
    const refs = affects.length > 0 ? affects.map((a) => str(a.ref, 2000)) : [null];
    const advisories = arr(v.advisories).filter(isObj);
    const source = isObj(v.source) ? v.source : {};
    const description = [str(v.description, 8000), str(v.detail, 8000)].filter(Boolean).join("\n\n") || null;
    const recommendation = str(v.recommendation, 4000);

    for (const ref of refs) {
      const comp = ref ? components.get(ref) : undefined;
      const packageName = comp?.name ?? (ref ? str(ref, 500) : null);
      const packageVersion = comp?.version ?? null;
      const affect = affects.find((a) => str(a.ref, 2000) === ref);
      const label = packageName ? `${packageName}${packageVersion ? `@${packageVersion}` : ""}` : null;
      findings.push({
        fingerprint: sha256("cyclonedx", comp?.purl ?? label, id),
        category: "SCA",
        ruleId: id,
        title: str(label ? `${id} em ${label}` : id, 500)!,
        severity: severity ?? "MEDIUM",
        cweId: extractCwe(arr(v.cwes)),
        filePath: null,
        startLine: null,
        endLine: null,
        snippet: null,
        packageName,
        packageVersion,
        purl: comp?.purl ?? null,
        fixedVersion: versaoCorrigida(affect, recommendation),
        advisoryId: id,
        cvssScore: score,
        cvssVector: vector,
        description,
        recommendation,
        helpUri: str(advisories[0]?.url, 2000) ?? str(source.url, 2000),
      });
    }
  }

  // Caso real (Juice Shop, 2026-11-13): sem lockfile, o Trivy gera um SBOM
  // vazio e válido. Sem aviso, "0 achados" pareceria "nada vulnerável".
  if (counter.n === 0) {
    warnings.push("O SBOM não lista nenhum componente: a ferramenta provavelmente não encontrou um lockfile (ex.: package-lock.json) no projeto analisado.");
  }
    if (vulns.some((v) => arr(v.ratings).length === 0)) {
    warnings.push("Há vulnerabilidades sem `ratings` no SBOM: a severidade delas ficou MEDIUM até a triagem.");
  }

  return {
    format: "CYCLONEDX",
    toolName: tool.name,
    toolVersion: tool.version,
    findings: dedupe(findings, warnings),
    componentsCount: counter.n,
    warnings,
  };
}

// ============================================================================
// Rascunho de promoção para Vulnerability
// ============================================================================

/**
 * Vetor sugerido por severidade. Como no DAST (ADR-032), é SUGESTÃO: a tela
 * avisa e o pentester revisa — o score só nasce do vetor confirmado (RN10).
 * CRITICAL não existe no ZAP, por isso o mapa do DAST não cobre essa faixa.
 */
const SUGGESTED_VECTOR_BY_SEVERITY: Record<CodeSeverity, string> = {
  CRITICAL: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
  HIGH: "CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:N",
  MEDIUM: "CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:L/I:L/A:N",
  LOW: "CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:L/I:N/A:N",
  INFO: "CVSS:3.1/AV:N/AC:H/PR:H/UI:R/S:U/C:N/I:N/A:N",
};

export interface CodePromotionDraft {
  title: string;
  description: string;
  owaspCategory: string;
  cvssVector: string;
  /** "TOOL" quando o vetor veio do próprio relatório (ex.: NVD via Trivy); "SEVERITY" quando é a sugestão por faixa. */
  cvssVectorSource: "TOOL" | "SEVERITY";
  recommendation: string | null;
  impact: string | null;
}

type DraftInput = Pick<
  ParsedCodeFinding,
  "title" | "category" | "ruleId" | "severity" | "cweId" | "filePath" | "startLine" | "snippet" | "packageName" | "packageVersion" | "fixedVersion" | "advisoryId" | "cvssVector" | "description" | "recommendation" | "helpUri"
>;

export function buildCodePromotionDraft(
  finding: DraftInput,
  origem: { toolName: string; fileName: string },
  owaspForCwe: (cwe: string | null) => string,
  vetorValido: (vector: string) => boolean,
): CodePromotionDraft {
  const ondeSast = finding.filePath ? `${finding.filePath}${finding.startLine ? `:${finding.startLine}` : ""}` : null;
  const pacote = finding.packageName ? `${finding.packageName}${finding.packageVersion ? `@${finding.packageVersion}` : ""}` : null;
  const partes = [
    finding.description ?? "Achado reportado pela ferramenta sem descrição detalhada.",
    "",
    `--- Origem (${finding.category} importado) ---`,
    `Ferramenta: ${origem.toolName} (arquivo ${origem.fileName})`,
    `Regra: ${finding.ruleId}`,
    ondeSast ? `Local: ${ondeSast}` : null,
    pacote ? `Componente: ${pacote}` : null,
    finding.fixedVersion ? `Versão corrigida: ${finding.fixedVersion}` : null,
    finding.cweId ? `CWE-${finding.cweId}` : null,
    finding.helpUri ? `Referência: ${finding.helpUri}` : null,
    finding.snippet ? `Trecho:\n${finding.snippet.slice(0, 800)}` : null,
  ].filter((l): l is string => l !== null);

  // As métricas base do CVSS 3.1 são as mesmas do 3.0 (FIRST, spec 3.1):
  // reescrever o prefixo deixa o calculador (só 3.1, RN10) aceitar o vetor da
  // ferramenta. O score pode variar uma casa decimal — por isso continua
  // sendo sugestão que o humano confirma.
  const vetor31 = finding.cvssVector?.replace(/^CVSS:3\.0\//, "CVSS:3.1/") ?? null;
  const vetorDaFerramenta = vetor31 && vetorValido(vetor31) ? vetor31 : null;
  const recomendacao =
    finding.recommendation ??
    (finding.fixedVersion && pacote ? `Atualize ${finding.packageName} para ${finding.fixedVersion} ou superior.` : null);

  return {
    title: finding.title,
    description: partes.join("\n"),
    // Componente com CVE conhecida é A06 por definição, qualquer que seja o CWE do bug.
    owaspCategory: finding.category === "SCA" ? "A06" : owaspForCwe(finding.cweId),
    cvssVector: vetorDaFerramenta ?? SUGGESTED_VECTOR_BY_SEVERITY[finding.severity],
    cvssVectorSource: vetorDaFerramenta ? "TOOL" : "SEVERITY",
    recommendation: recomendacao,
    impact: null,
  };
}
