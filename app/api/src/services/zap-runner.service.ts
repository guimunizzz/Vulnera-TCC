/**
 * zap-runner.service.ts
 *
 * Motor de execução do scan DAST: sobe UM container do OWASP ZAP por scan via
 * `docker run --rm`, espera terminar (ou mata por timeout), e devolve onde os
 * relatórios (report.json/report.html) ficaram no disco do host.
 *
 * Por que não é uma classe com injeção de dependência como os outros services
 * (CLAUDE.md §5.3): este módulo NÃO toca o Prisma — não sabe o que é um
 * DastScan, não marca status, não grava nada no banco. Só executa o processo
 * e devolve um resultado descritivo. Quem orquestra (cria o registro QUEUED,
 * decide RUNNING/COMPLETED/FAILED, aciona o pipeline de findings) é o
 * `dast-scan.service.ts` da Fase 4 — mesma separação que `push.util.ts` já
 * usa (utilitário "puro", sem acesso a banco, best-effort onde faz sentido).
 * Mantém a regra do CLAUDE.md de que só Repository importa `@prisma/client`.
 *
 * SEGURANÇA (ver docs/DAST.md §5 pra detalhe de cada item):
 *  - `execFile`, NUNCA `exec`/`shell:true` — argumentos vão como array pro
 *    processo, nunca interpolados numa string de shell. Uma targetUrl com
 *    `; rm -rf /` vira só um argumento de URL inválido, nunca um comando.
 *  - `validateTargetUrl` bloqueia protocolo != http/https e, por padrão,
 *    loopback/faixas privadas (SSRF) — liberável via DAST_ALLOW_PRIVATE_TARGETS.
 *  - `resolveReportPath` impede path traversal ao servir report.html/json.
 *
 * ⚠️ Limitação conhecida: a checagem de host privado é sobre o LITERAL da URL
 * (hostname/IP escrito), não sobre DNS resolvido. Um hostname público que só
 * resolve pra IP privado em tempo de requisição (DNS rebinding) não é pego
 * aqui — documentado em docs/DAST.md §10, fora de escopo desta entrega.
 *
 * Fallback simulado (`simulateScan`): se `docker info` falhar (Docker Desktop
 * fechado, ambiente de CI sem Docker), gera report.json/report.html estáticos
 * com ~8 alertas representativos depois de um pequeno delay — sem isso o CI
 * não roda um scan de verdade e nenhum teste do pipeline seria executável.
 */

import { execFile } from "child_process";
import * as fs from "fs/promises";
import * as path from "path";
import { EnvVar } from "../config/EnvVar";
import { EnvKeys } from "../config/enum/EnvKeys";

const ZAP_IMAGE = EnvVar.getOptional(EnvKeys.DAST_ZAP_IMAGE, "ghcr.io/zaproxy/zaproxy:stable");
const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000; // 30min — mesmo valor do default documentado no prompt da Fase 2
const SIMULATE_DELAY_MS = 3000; // "alguns segundos", curto o bastante pra não travar a suíte de testes

// path.resolve(process.cwd(), ...) — mesmo padrão de UPLOADS_ROOT em evidence.service.ts
function getReportsDir(): string {
  return path.resolve(process.cwd(), EnvVar.getOptional(EnvKeys.DAST_REPORTS_DIR, "dast-reports"));
}

function getTimeoutMs(): number {
  const raw = EnvVar.getOptional(EnvKeys.DAST_SCAN_TIMEOUT_MS, String(DEFAULT_TIMEOUT_MS));
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

function allowPrivateTargets(): boolean {
  return EnvVar.getOptional(EnvKeys.DAST_ALLOW_PRIVATE_TARGETS, "false").toLowerCase() === "true";
}

export function containerNameFor(scanId: string): string {
  return `vulnera-zap-${scanId}`;
}

// ============================================================================
// Validação de alvo (SSRF)
// ============================================================================

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const value = Number(part);
    if (value < 0 || value > 255) return null;
    n = (n << 8) | value;
  }
  return n >>> 0;
}

function isIpInCidr(ipInt: number, cidr: string): boolean {
  const [base, bitsRaw] = cidr.split("/");
  const baseInt = ipv4ToInt(base);
  const bits = Number(bitsRaw);
  if (baseInt === null || Number.isNaN(bits)) return false;
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ipInt & mask) === (baseInt & mask);
}

// Faixas do prompt (RFC1918 + loopback + link-local). Não cobre IPv6 além de
// ::1 — bloqueio de ULA/link-local IPv6 fica pra quando o produto precisar.
const PRIVATE_IPV4_CIDRS = ["127.0.0.0/8", "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "169.254.0.0/16"];

export function isPrivateOrLoopbackHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, ""); // remove colchetes de literal IPv6 (ex: [::1])
  if (host === "localhost" || host === "::1") return true;
  const ipInt = ipv4ToInt(host);
  if (ipInt === null) return false;
  return PRIVATE_IPV4_CIDRS.some((cidr) => isIpInCidr(ipInt, cidr));
}

/** Lança INVALID_TARGET_URL (protocolo/formato) ou TARGET_NOT_ALLOWED (SSRF). */
export function validateTargetUrl(targetUrl: string, allowPrivate: boolean = allowPrivateTargets()): URL {
  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    throw new Error("INVALID_TARGET_URL");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("INVALID_TARGET_URL");
  }
  if (!allowPrivate && isPrivateOrLoopbackHost(parsed.hostname)) {
    throw new Error("TARGET_NOT_ALLOWED");
  }
  return parsed;
}

// ============================================================================
// Execução do processo docker (execFile — nunca exec/shell)
// ============================================================================

interface ExecResult {
  code: number | null;
  signal: NodeJS.Signals | null;
  killed: boolean;
  stdout: string;
  stderr: string;
}

function runDocker(args: string[], opts: { timeout?: number } = {}): Promise<ExecResult> {
  return new Promise((resolve) => {
    execFile(
      "docker",
      args,
      { windowsHide: true, timeout: opts.timeout, maxBuffer: 20 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (!error) {
          resolve({ code: 0, signal: null, killed: false, stdout: stdout?.toString() ?? "", stderr: stderr?.toString() ?? "" });
          return;
        }
        const err = error as NodeJS.ErrnoException & { signal?: NodeJS.Signals; killed?: boolean };
        resolve({
          code: typeof err.code === "number" ? err.code : null,
          signal: err.signal ?? null,
          killed: !!err.killed,
          stdout: stdout?.toString() ?? "",
          stderr: stderr?.toString() ?? "",
        });
      },
    );
  });
}

export async function isDockerAvailable(): Promise<boolean> {
  // 10s, não 5s: `docker info` no Docker Desktop (Windows, backend WSL2)
  // observado levando ~6s pra responder mesmo com o daemon saudável — um
  // timeout mais curto derrubava scans reais pro fallback simulado por
  // engano (achado na Fase 2, ver docs/DAST.md "Solução de problemas").
  const result = await runDocker(["info"], { timeout: 10000 });
  return result.code === 0;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export interface ScanOutcome {
  status: "COMPLETED" | "FAILED";
  jsonReportPath?: string; // absoluto no disco do host
  htmlReportPath?: string; // absoluto no disco do host
  errorMessage?: string;
  durationMs: number;
  simulated: boolean;
}

// ============================================================================
// Scan real
// ============================================================================

async function runRealScan(scanId: string, targetUrl: string, timeoutMs: number): Promise<ScanOutcome> {
  const reportsDir = getReportsDir();
  const scanDir = path.resolve(reportsDir, scanId);
  await fs.mkdir(scanDir, { recursive: true });

  const containerName = containerNameFor(scanId);
  const started = Date.now();

  // Caminho nativo do Windows (`C:\Users\...`) funciona direto no `-v` do
  // Docker Desktop QUANDO quem chama `docker.exe` é o Node (execFile chama o
  // binário direto, sem shell). O bug clássico só aparece se algo re-escreve
  // o path antes (Git Bash/MSYS interpretam `/tmp/...` e mangling de `:`) —
  // validado manualmente na Fase 0 via PowerShell puro. Nenhuma conversão de
  // path é necessária aqui; ver docs/DAST.md "Solução de problemas".
  const hostDir = scanDir;

  const args = [
    "run",
    "--rm",
    "--name",
    containerName,
    "-v",
    `${hostDir}:/zap/wrk/:rw`,
    ZAP_IMAGE,
    "zap-full-scan.py",
    "-t",
    targetUrl,
    "-J",
    "report.json",
    "-r",
    "report.html",
  ];

  const result = await runDocker(args, { timeout: timeoutMs });
  const durationMs = Date.now() - started;

  const jsonPath = path.join(scanDir, "report.json");
  const htmlPath = path.join(scanDir, "report.html");

  // Timeout: `execFile` mata o PROCESSO CLIENTE docker, mas isso não garante
  // que o CONTAINER pare — docker é cliente/servidor, o container é gerido
  // pelo daemon, não é filho do processo `docker run`. `docker rm -f` é a
  // única forma confiável de garantir que ele morreu de verdade.
  if (result.killed) {
    await runDocker(["rm", "-f", containerName], { timeout: 10000 });
    return { status: "FAILED", errorMessage: "SCAN_TIMEOUT", durationMs, simulated: false };
  }

  // Critério de sucesso: report.json existe E parseia — NUNCA o exit code.
  // zap-full-scan.py retorna != 0 quando encontra alertas (WARN/FAIL), isso é
  // o comportamento NORMAL de um scan bem-sucedido, não uma falha de execução.
  if (!(await fileExists(jsonPath))) {
    const detail = result.stderr.trim().slice(0, 2000) || `docker saiu com código ${result.code ?? "desconhecido"} sem gerar report.json`;
    return { status: "FAILED", errorMessage: detail, durationMs, simulated: false };
  }

  try {
    JSON.parse(await fs.readFile(jsonPath, "utf-8"));
  } catch {
    return { status: "FAILED", errorMessage: "REPORT_JSON_INVALID", durationMs, simulated: false };
  }

  return {
    status: "COMPLETED",
    jsonReportPath: jsonPath,
    htmlReportPath: (await fileExists(htmlPath)) ? htmlPath : undefined,
    durationMs,
    simulated: false,
  };
}

/** `docker rm -f` no container determinístico do scan — cancelamento e limpeza de timeout usam a mesma função. */
export async function killContainer(scanId: string): Promise<void> {
  await runDocker(["rm", "-f", containerNameFor(scanId)], { timeout: 10000 });
  // Não lança em "No such container": scan já tinha terminado (--rm já
  // limpou sozinho) ou era simulado (nunca existiu container de verdade).
  // cancel() no service de negócio é best-effort por design — quem chama já
  // marca CANCELLED no banco independente do resultado aqui.
}

// ============================================================================
// Fallback simulado — Docker indisponível (docker info falhou)
// ============================================================================

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Gera as ~8 alertas representativas no MESMO formato real do ZAP (mapeado na Fase 0). */
function buildSimulatedAlerts(target: URL): unknown[] {
  const base = target.origin;
  const externalInstance = {
    id: "999",
    uri: "https://cdn.external-example.test/lib.js",
    nodeName: "https://cdn.external-example.test/lib.js",
    method: "GET",
    param: "",
    attack: "",
    evidence: "",
    otherinfo: "",
  };

  const alert = (over: Record<string, unknown>) => ({
    alertRef: `${over.pluginid}-1`,
    name: over.alert,
    confidence: "3",
    systemic: false,
    otherinfo: "",
    sourceid: "1",
    ...over,
  });

  const instance = (uriPath: string, param = "", extra: Record<string, unknown> = {}) => ({
    id: String(Math.floor(Math.random() * 1000)),
    uri: `${base}${uriPath}`,
    nodeName: `${base}${uriPath}`,
    method: "GET",
    param,
    attack: "",
    evidence: "",
    otherinfo: "",
    ...extra,
  });

  return [
    alert({
      pluginid: "40018",
      alert: "SQL Injection",
      riskcode: "3",
      confidence: "3",
      riskdesc: "High (High)",
      desc: "<p>SQL injection pode permitir ao atacante ler/alterar dados do banco.</p>",
      solution: "<p>Use queries parametrizadas/prepared statements.</p>",
      reference: "<p>https://owasp.org/www-community/attacks/SQL_Injection</p>",
      cweid: "89",
      wascid: "19",
      count: "2",
      instances: [instance("/search", "q", { attack: "' OR '1'='1" }), instance("/login", "user")],
    }),
    alert({
      pluginid: "90020",
      alert: "Remote OS Command Injection",
      riskcode: "3",
      confidence: "2",
      riskdesc: "High (Medium)",
      desc: "<p>Permite executar comandos arbitrários no servidor.</p>",
      solution: "<p>Nunca repasse input do usuário pra shell; use APIs seguras.</p>",
      reference: "<p>https://owasp.org/www-community/attacks/Command_Injection</p>",
      cweid: "78",
      wascid: "31",
      count: "1",
      instances: [instance("/api/ping", "host", { attack: "127.0.0.1; id" })],
    }),
    alert({
      pluginid: "40012",
      alert: "Cross Site Scripting (Reflected)",
      riskcode: "3",
      confidence: "3",
      riskdesc: "High (High)",
      desc: "<p>Entrada refletida sem sanitização permite injeção de script no navegador da vítima.</p>",
      solution: "<p>Codifique a saída conforme o contexto (HTML/JS/URL).</p>",
      reference: "<p>https://owasp.org/www-community/attacks/xss/</p>",
      cweid: "79",
      wascid: "8",
      count: "2",
      instances: [instance("/search", "q", { attack: "<script>alert(1)</script>" }), instance("/comment", "text")],
    }),
    alert({
      pluginid: "10038",
      alert: "Content Security Policy (CSP) Header Not Set",
      riskcode: "2",
      confidence: "3",
      riskdesc: "Medium (High)",
      desc: "<p>Sem CSP, o navegador não tem uma camada extra de defesa contra XSS/injeção de dados.</p>",
      solution: "<p>Configure o header Content-Security-Policy.</p>",
      reference: "<p>https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP</p>",
      cweid: "693",
      wascid: "15",
      count: "3",
      instances: [instance("/"), instance("/login"), instance("/api")],
    }),
    alert({
      pluginid: "10020",
      alert: "Missing Anti-clickjacking Header",
      riskcode: "2",
      confidence: "2",
      riskdesc: "Medium (Medium)",
      desc: "<p>Sem X-Frame-Options/CSP frame-ancestors, a página pode ser embutida em iframe de terceiros (clickjacking).</p>",
      solution: "<p>Configure X-Frame-Options: DENY ou CSP frame-ancestors.</p>",
      reference: "<p>https://owasp.org/www-community/attacks/Clickjacking</p>",
      cweid: "1021",
      wascid: "15",
      count: "2",
      instances: [instance("/"), instance("/login")],
    }),
    alert({
      pluginid: "10010",
      alert: "Cookie No HttpOnly Flag",
      riskcode: "1",
      confidence: "3",
      riskdesc: "Low (High)",
      desc: "<p>Cookie sem HttpOnly pode ser lido via JavaScript — risco em caso de XSS.</p>",
      solution: "<p>Marque o cookie de sessão como HttpOnly.</p>",
      reference: "<p>https://owasp.org/www-community/HttpOnly</p>",
      cweid: "1004",
      wascid: "13",
      count: "2",
      instances: [instance("/"), instance("/login")],
    }),
    alert({
      pluginid: "10021",
      alert: "X-Content-Type-Options Header Missing",
      riskcode: "1",
      confidence: "2",
      riskdesc: "Low (Medium)",
      desc: "<p>Sem nosniff, o navegador pode reinterpretar o tipo de conteúdo por heurística.</p>",
      solution: "<p>Configure X-Content-Type-Options: nosniff.</p>",
      reference: "<p>https://owasp.org/www-project-secure-headers/</p>",
      cweid: "693",
      wascid: "15",
      count: "2",
      instances: [instance("/"), instance("/api")],
    }),
    alert({
      pluginid: "10096",
      alert: "Timestamp Disclosure",
      riskcode: "0",
      confidence: "2",
      riskdesc: "Informational (Medium)",
      desc: "<p>Um timestamp Unix foi identificado na resposta.</p>",
      solution: "<p>Avalie se a informação exposta é sensível ao contexto.</p>",
      reference: "<p>https://owasp.org/</p>",
      cweid: "200",
      wascid: "13",
      count: "2",
      // segunda instance é de domínio EXTERNO de propósito — exercita o
      // descarte por escopo do pipeline (Fase 3) mesmo no fallback simulado.
      instances: [instance("/api/status"), externalInstance],
    }),
  ];
}

/**
 * `timeoutMs` opcional deixa o fallback simulado honrar o MESMO contrato de
 * timeout do scan real — importante pro teste DAST-LIFE-03 (timeout marca
 * FAILED) rodar sem Docker: um `DAST_SCAN_TIMEOUT_MS` bem baixo faz o
 * simulado também "estourar" em vez de sempre completar em 3s fixos.
 */
export async function simulateScan(scanId: string, targetUrl: string, timeoutMs?: number): Promise<ScanOutcome> {
  const willTimeout = timeoutMs !== undefined && timeoutMs < SIMULATE_DELAY_MS;
  const delay = willTimeout ? timeoutMs : SIMULATE_DELAY_MS;
  await new Promise((resolve) => setTimeout(resolve, delay));

  if (willTimeout) {
    return { status: "FAILED", errorMessage: "SCAN_TIMEOUT", durationMs: delay, simulated: true };
  }

  const reportsDir = getReportsDir();
  const scanDir = path.resolve(reportsDir, scanId);
  await fs.mkdir(scanDir, { recursive: true });

  const target = new URL(targetUrl);
  const alerts = buildSimulatedAlerts(target);

  const jsonReport = {
    "@programName": "ZAP (simulado — Docker indisponível)",
    "@version": "simulated",
    "@generated": new Date().toUTCString(),
    created: new Date().toISOString(),
    insights: [],
    site: [{ "@name": target.origin, "@host": target.hostname, "@port": String(target.port || (target.protocol === "https:" ? 443 : 80)), "@ssl": String(target.protocol === "https:"), alerts }],
    sequences: [],
  };

  const jsonPath = path.join(scanDir, "report.json");
  const htmlPath = path.join(scanDir, "report.html");
  await fs.writeFile(jsonPath, JSON.stringify(jsonReport, null, 2), "utf-8");

  const safeTarget = escapeHtml(targetUrl);
  const rows = alerts
    .map((a) => {
      const alertObj = a as { alert: string; riskdesc: string; count: string };
      return `<tr><td>${escapeHtml(alertObj.alert)}</td><td>${escapeHtml(alertObj.riskdesc)}</td><td>${escapeHtml(alertObj.count)}</td></tr>`;
    })
    .join("\n");
  const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>ZAP Scanning Report (simulado)</title></head>
<body>
<h1>ZAP Scanning Report — SIMULADO (Docker indisponível)</h1>
<p>Alvo: ${safeTarget}</p>
<table border="1"><thead><tr><th>Alerta</th><th>Risco</th><th>Ocorrências</th></tr></thead><tbody>
${rows}
</tbody></table>
</body></html>`;
  await fs.writeFile(htmlPath, html, "utf-8");

  return {
    status: "COMPLETED",
    jsonReportPath: jsonPath,
    htmlReportPath: htmlPath,
    durationMs: SIMULATE_DELAY_MS,
    simulated: true,
  };
}

// ============================================================================
// Orquestração pública
// ============================================================================

export interface RunScanOptions {
  scanId: string;
  targetUrl: string;
  timeoutMs?: number;
}

/** Decide real vs simulado (via `docker info`, ou DAST_FORCE_SIMULATE) e roda o scan até concluir, timeoutar ou falhar. */
export async function runScan(options: RunScanOptions): Promise<ScanOutcome> {
  const forceSimulate = EnvVar.getOptional(EnvKeys.DAST_FORCE_SIMULATE, "false").toLowerCase() === "true";
  const dockerOk = !forceSimulate && (await isDockerAvailable());
  const timeoutMs = options.timeoutMs ?? getTimeoutMs();
  if (!dockerOk) {
    return simulateScan(options.scanId, options.targetUrl, timeoutMs);
  }
  return runRealScan(options.scanId, options.targetUrl, timeoutMs);
}

// ============================================================================
// Leitura segura de relatório (guarda contra path traversal)
// ============================================================================

/** `basename` + whitelist de extensão + confere que o caminho final não escapou de reportsDir/scanId. */
export function resolveReportPath(scanId: string, fileName: string): string {
  const reportsDir = getReportsDir();
  const safeName = path.basename(fileName);
  if (!/^[a-zA-Z0-9._-]+\.(html|json)$/.test(safeName)) {
    throw new Error("INVALID_REPORT_NAME");
  }
  const resolved = path.resolve(reportsDir, scanId, safeName);
  if (!resolved.startsWith(path.resolve(reportsDir) + path.sep)) {
    throw new Error("INVALID_REPORT_PATH");
  }
  return resolved;
}

export async function readReportFile(scanId: string, fileName: string): Promise<Buffer> {
  const resolved = resolveReportPath(scanId, fileName);
  try {
    return await fs.readFile(resolved);
  } catch {
    throw new Error("REPORT_NOT_FOUND");
  }
}

export const __internal = { getReportsDir, getTimeoutMs, allowPrivateTargets };
