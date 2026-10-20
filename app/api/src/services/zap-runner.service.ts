/**
 * Executa demonstrações explícitas ou análise passiva real pelo OWASP ZAP.
 * O runner isola um daemon por scan e descobre URLs pelo Spider tradicional,
 * restrito ao escopo e sem formulários, JavaScript, autenticação ou active scan. Retentativas de
 * leitura toleram lentidão sem duplicar comandos. Falha real nunca vira demo.
 * Consumidor: DastScanService. Diagnóstico local é salvo antes da limpeza.
 */

import { execFile } from "child_process";
import { randomBytes } from "crypto";
import * as http from "http";
import * as net from "net";
import * as fs from "fs/promises";
import * as path from "path";
import { EnvVar } from "../config/EnvVar";
import { EnvKeys } from "../config/enum/EnvKeys";

const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000; // 30min — mesmo valor do default documentado no prompt da Fase 2
const SIMULATE_DELAY_MS = 3000; // "alguns segundos", curto o bastante pra não travar a suíte de testes
const ZAP_INTERNAL_PORT = 8080; // porta do daemon quando API e ZAP dividem a rede do compose (ver resolveZapEndpoint)
const ZAP_POLL_INTERVAL_MS = 3000; // cadência de polling na API do ZAP — também é o "pulso" lido pelo watchdog

// Lido em chamada, não no import: process.env pode mudar entre testes (a
// suíte troca DAST_* em beforeAll/afterAll) e uma const de módulo congelaria
// o valor da primeira importação.
function getZapImage(): string {
  return EnvVar.getOptional(EnvKeys.DAST_ZAP_IMAGE, "ghcr.io/zaproxy/zaproxy:stable");
}

/** Nome da rede Docker onde criar o container do ZAP. Vazio = API roda no host (publica porta em 127.0.0.1). */
function getZapNetwork(): string {
  return EnvVar.getOptional(EnvKeys.DAST_ZAP_NETWORK, "").trim();
}

function getStartupTimeoutMs(): number {
  const parsed = Number(EnvVar.getOptional(EnvKeys.DAST_ZAP_STARTUP_TIMEOUT_MS, "180000"));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 180000;
}

function getSpiderMaxDurationMin(): number {
  const parsed = Number(EnvVar.getOptional(EnvKeys.DAST_ZAP_SPIDER_MAX_DURATION_MIN, "1"));
  // Zero significa ilimitado no ZAP; nosso perfil precisa sempre de um teto.
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(10, Math.max(1, Math.floor(parsed))) : 1;
}

/**
 * Teto de RAM de CADA container do ZAP, no formato do Docker ("2g", "1536m").
 *
 * ⚠️ Por que isto existe, se o watchdog já limita a 2 scans: os dois limites
 * são de eixos DIFERENTES e nenhum cobre o outro. O watchdog limita QUANTOS
 * scans rodam; este limita QUANTO cada um consome. Medição de 2026-09-09 com
 * 2 scans reais simultâneos e SEM estes limites:
 *
 *     vulnera-zap-...ib0007 | 936.8MiB / 7.7GiB | CPU 398%
 *     vulnera-zap-...g30003 |  1.39GiB / 7.7GiB | CPU 564%
 *
 * "7.7GiB" ali é a RAM inteira da VM do Docker — ou seja, teto nenhum — e os
 * dois juntos ocupavam ~960% de 1200% de CPU. Respeitar o limite de 2 scans e
 * ainda assim travar a máquina não é respeitar limite nenhum, e o cenário em
 * que isso dói é justamente o pior possível: a apresentação do TCC.
 */
function getZapMemory(): string {
  return EnvVar.getOptional(EnvKeys.DAST_ZAP_MEMORY, "2g").trim();
}

function getZapCpus(): string {
  return EnvVar.getOptional(EnvKeys.DAST_ZAP_CPUS, "2").trim();
}

/** "2g"/"1536m"/"2048" (bytes) -> MB. Devolve null pro que não entender, e aí o limite é omitido em vez de chutado. */
export function parseMemoryToMb(raw: string): number | null {
  const match = /^(\d+(?:\.\d+)?)\s*([bkmg])?b?$/i.exec(raw.trim());
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) return null;
  const unitFactorMb: Record<string, number> = { b: 1 / (1024 * 1024), k: 1 / 1024, m: 1, g: 1024 };
  const mb = value * (unitFactorMb[(match[2] ?? "b").toLowerCase()] ?? 1);
  return mb >= 1 ? Math.floor(mb) : null;
}

/**
 * Heap da JVM do ZAP, derivado do teto de RAM do container.
 *
 * ⚠️ ARMADILHA: sem `-Xmx` explícito o `zap.sh` calcula o heap como 1/4 da
 * memória que ele LÊ — e o que ele lê (`/proc/meminfo`) é a RAM do HOST, não
 * o limite do cgroup. Com `--memory 2g` e sem `-Xmx`, a JVM acharia que tem
 * 7.7GB disponíveis, pediria ~1.9GB de heap e seria morta por OOM do cgroup
 * no meio do active scan. Por isso os dois SEMPRE andam juntos, e o heap fica
 * folgadamente abaixo do teto: ~65%, deixando o resto pra metaspace, stacks e
 * buffers diretos, que não entram no -Xmx mas contam no cgroup.
 */
export function heapArgForMemoryLimit(memoryLimit: string): string | null {
  const limitMb = parseMemoryToMb(memoryLimit);
  if (limitMb === null) return null;
  const heapMb = Math.floor(limitMb * 0.65);
  // Abaixo de 256MB o ZAP não sobe de forma confiável — melhor não passar
  // limite nenhum do que passar um que quebra o scan por dentro.
  return heapMb >= 256 ? `-Xmx${heapMb}m` : null;
}

// path.resolve(process.cwd(), ...) — mesmo padrão de UPLOADS_ROOT em evidence.service.ts
function getReportsDir(): string {
  return path.resolve(process.cwd(), EnvVar.getOptional(EnvKeys.DAST_REPORTS_DIR, "dast-reports"));
}

function getTimeoutMs(): number {
  const raw = EnvVar.getOptional(EnvKeys.DAST_SCAN_TIMEOUT_MS, String(DEFAULT_TIMEOUT_MS));
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

export function containerNameFor(scanId: string): string {
  return `vulnera-zap-${scanId}`;
}

// ============================================================================
// Validação de formato do alvo
// ============================================================================

/** Aceita alvos HTTP/HTTPS públicos ou internos; a conectividade é verificada pelo ZAP. */
export function validateTargetUrl(targetUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    throw new Error("INVALID_TARGET_URL");
  }
  if (parsed.username || parsed.password || (parsed.protocol !== "http:" && parsed.protocol !== "https:")) {
    throw new Error("INVALID_TARGET_URL");
  }
  parsed.hash = "";
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

/**
 * Mesma checagem de `isDockerAvailable`, porém CACHEADA por 30s.
 * `docker info` custa alguns segundos; o endpoint de status do módulo é
 * consultado em polling pela UI, e sem cache cada tela aberta somaria um
 * `docker info` a cada poucos segundos.
 */
let dockerStatusCache: { available: boolean; checkedAt: number } | null = null;
const DOCKER_STATUS_TTL_MS = 30000;

export async function getDockerStatus(): Promise<{ available: boolean; checkedAt: string }> {
  const now = Date.now();
  if (!dockerStatusCache || now - dockerStatusCache.checkedAt > DOCKER_STATUS_TTL_MS) {
    dockerStatusCache = { available: await isDockerAvailable(), checkedAt: now };
  }
  return { available: dockerStatusCache.available, checkedAt: new Date(dockerStatusCache.checkedAt).toISOString() };
}

export async function isDockerAvailable(): Promise<boolean> {
  // 10s, não 5s: `docker info` no Docker Desktop (Windows, backend WSL2)
  // observado levando ~6s pra responder mesmo com o daemon saudável — um
  // timeout mais curto derrubava scans reais pro fallback simulado por
  // engano (achado na Fase 2, ver docs/DAST.md "Solução de problemas").
  const result = await runDocker(["info"], { timeout: 10000 });
  return result.code === 0;
}

export type ScanPhase = "STARTING" | "SPIDER" | "PASSIVE" | "ACTIVE" | "REPORT" | "DONE" | "SIMULATED";

/** Rótulos em PT-BR de cada fase — a UI mostra estes textos ao lado da barra. */
export const SCAN_PHASE_LABELS: Record<ScanPhase, string> = {
  STARTING: "Subindo o OWASP ZAP",
  SPIDER: "Rastreando o alvo (spider)",
  PASSIVE: "Analisando respostas (scan passivo)",
  ACTIVE: "Testando vulnerabilidades (scan ativo)",
  REPORT: "Gerando relatórios",
  DONE: "Concluído",
  SIMULATED: "Resultado simulado",
};

export interface ScanProgress {
  percent: number; // 0..100 consolidado das fases
  phase: ScanPhase;
  message: string; // frase curta em PT-BR pra UI
}

export interface ScanOutcome {
  status: "COMPLETED" | "FAILED";
  jsonReportPath?: string; // absoluto no disco de quem roda a API
  htmlReportPath?: string; // absoluto no disco de quem roda a API
  errorMessage?: string;
  /** Aviso amigável que identifica os dados fictícios da demonstração. */
  warningMessage?: string;
  durationMs: number;
  simulated: boolean;
}

export interface RunScanOptions {
  scanId: string;
  targetUrl: string;
  mode: "REAL" | "SIMULATED";
  timeoutMs?: number;
  /** Chamado a cada tick de polling — alimenta a barra da UI e o pulso do watchdog. */
  onProgress?: (progress: ScanProgress) => void;
  /** Cancelamento cooperativo: o watchdog aborta, o runner para no próximo tick. */
  signal?: AbortSignal;
}

// ============================================================================
// Cliente HTTP da API do ZAP
//
// `http.request` puro em vez de fetch/axios de propósito: é tráfego local
// (loopback ou rede interna do compose), sempre http, e o módulo `http` já vem
// no Node — não vale uma dependência nova, e o controle de timeout por
// requisição aqui é mais direto do que via AbortController.
// ============================================================================

interface ZapHttpResponse {
  status: number;
  body: string;
}

function httpGet(url: string, timeoutMs: number, signal?: AbortSignal): Promise<ZapHttpResponse> {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout: timeoutMs }, (res) => {
      const chunks: Buffer[] = [];
      let bytes = 0;
      res.on("data", (chunk: Buffer) => {
        bytes += chunk.length;
        // Um relatório/página enorme não pode consumir a RAM inteira da API.
        if (bytes > 20 * 1024 * 1024) req.destroy(new Error("ZAP_RESPONSE_TOO_LARGE"));
        else chunks.push(chunk);
      });
      res.on("end", () => { cleanup(); resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf-8") }); });
      res.on("error", (error) => { cleanup(); reject(error); });
      res.on("aborted", () => { cleanup(); reject(new Error("ECONNRESET")); });
    });
    // Prazo absoluto além de inatividade: resposta em gotejamento também termina.
    const timer = setTimeout(() => req.destroy(new Error("ZAP_HTTP_TIMEOUT")), timeoutMs);
    const abort = () => req.destroy(new Error("SCAN_CANCELLED"));
    const cleanup = () => { clearTimeout(timer); signal?.removeEventListener("abort", abort); };
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
    req.on("timeout", () => req.destroy(new Error("ZAP_HTTP_TIMEOUT")));
    req.on("error", (error: NodeJS.ErrnoException) => { cleanup(); reject(new Error(error.code ?? error.message)); });
  });
}

/** Monta a URL de um endpoint do ZAP com querystring — `URL` escapa os valores (targetUrl inclusive). */
export function buildZapUrl(baseUrl: string, endpoint: string, params: Record<string, string>): string {
  const url = new URL(endpoint, baseUrl);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}

/**
 * Chama um endpoint /JSON/ do ZAP e devolve o objeto já parseado.
 * O ZAP responde erro de negócio com HTTP 200 + `{"code":"url_not_found",...}`,
 * então checar só o status não basta — o `code` é conferido aqui.
 */
async function zapJson(
  baseUrl: string,
  endpoint: string,
  params: Record<string, string>,
  timeoutMs = 45000,
  signal?: AbortSignal,
): Promise<Record<string, unknown>> {
  const response = await httpGet(buildZapUrl(baseUrl, endpoint, params), timeoutMs, signal);
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(response.body) as Record<string, unknown>;
  } catch {
    if (response.status !== 200) throw new Error(`ZAP_HTTP_${response.status}`);
    throw new Error(`ZAP_BAD_RESPONSE:${endpoint}`);
  }
  // O ZAP também entrega erros estruturados com HTTP 500, por exemplo ao
  // tentar abrir uma porta fechada. Não descarte o código nesses casos.
  if ([502, 503, 504].includes(response.status)) throw new Error(`ZAP_HTTP_${response.status}`);
  if (typeof parsed.code === "string") {
    if (endpoint === "/JSON/core/action/accessUrl/" && parsed.code === "internal_error") {
      throw new Error("TARGET_ACCESS_FAILED");
    }
    throw new Error(`ZAP_API_ERROR:${parsed.code}`);
  }
  if (response.status !== 200) throw new Error(`ZAP_HTTP_${response.status}`);
  return parsed;
}

// ============================================================================
// Scan real — container do ZAP em modo daemon + API HTTP
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

/**
 * Pesos de cada fase no percentual consolidado. Empíricos, não medidos: o
 * active scan é de longe a fase mais demorada num alvo real, por isso leva a
 * maior fatia. O objetivo é a barra andar de forma plausível, não prever
 * duração.
 */
const PHASE_WEIGHTS = {
  startingFrom: 0,
  startingTo: 8,
  spiderTo: 45,
  passiveTo: 55,
  activeTo: 96,
} as const;

interface RealScanContext {
  baseUrl: string;
  apiKey: string;
  deadline: number;
  signal?: AbortSignal;
  report: (percent: number, phase: ScanPhase, message: string) => void;
  progress: ScanProgress;
  lastEndpoint?: string;
}

/**
 * Mantém o pulso do watchdog batendo durante uma operação longa que NÃO tem
 * progresso pra reportar.
 *
 * ⚠️ Por que é necessário: o watchdog aborta um scan que fique
 * DAST_HEARTBEAT_TIMEOUT_MS (2min por padrão) sem pulsar, e o runner só pulsa
 * dentro dos loops de polling. Duas operações ficam FORA de qualquer loop e
 * podem passar dos 2min legitimamente:
 *
 *  1. `docker run` na PRIMEIRA execução de uma máquina, quando a imagem do ZAP
 *     (~3.7GB) ainda não está local: o run faz o pull antes de subir. Sem
 *     keep-alive, o watchdog abortaria justamente o primeiro scan de uma
 *     máquina nova — exatamente o cenário do dia da apresentação.
 *  2. O download dos relatórios: cada `httpGet` tem timeout PRÓPRIO de 120s,
 *     e são dois em sequência (JSON + HTML). O pior caso passa dos 2min de
 *     silêncio, e o scan seria abortado depois de já ter feito todo o
 *     trabalho pesado.
 *
 * O pulso repete o MESMO percentual de propósito: a barra não anda (não há
 * medição real pra mostrar), mas o watchdog sabe que o processo está vivo.
 */
async function withKeepAlive<T>(operation: Promise<T>, tick: () => void, intervalMs = 15000): Promise<T> {
  const timer = setInterval(tick, intervalMs);
  timer.unref?.();
  try {
    return await operation;
  } finally {
    clearInterval(timer);
  }
}

/** Lança se o watchdog/usuário abortou ou se o prazo global do scan estourou. */
function assertStillRunning(ctx: RealScanContext): void {
  if (ctx.signal?.aborted) throw new Error("SCAN_CANCELLED");
  if (Date.now() > ctx.deadline) throw new Error("SCAN_TIMEOUT");
}

/** Espera o daemon responder /JSON/core/view/version/ — a JVM do ZAP leva ~20-40s pra subir. */
async function waitForZapReady(ctx: RealScanContext, startupDeadline: number): Promise<void> {
  const startedWaiting = Date.now();
  // A rampa usa o tempo TÍPICO de boot (~60s), não o teto de startup: com o
  // teto (180s) a barra andaria 3% em um minuto e pareceria travada. Se passar
  // dos 60s a rampa satura no topo da fase e o polling continua até o teto.
  const budget = Math.min(60000, Math.max(1, startupDeadline - startedWaiting));

  for (;;) {
    assertStillRunning(ctx);
    try {
      const version = await zapJson(ctx.baseUrl, "/JSON/core/view/version/", { apikey: ctx.apiKey }, Math.max(1, Math.min(5000, ctx.deadline - Date.now())), ctx.signal);
      if (version.version) return;
    } catch {
      // Conexão recusada é o estado NORMAL enquanto a JVM sobe — só vira erro
      // quando o orçamento de startup acaba, logo abaixo.
    }
    if (Date.now() > startupDeadline) throw new Error("ZAP_STARTUP_TIMEOUT");

    const elapsedRatio = Math.min(1, (Date.now() - startedWaiting) / budget);
    ctx.report(
      PHASE_WEIGHTS.startingFrom + elapsedRatio * (PHASE_WEIGHTS.startingTo - PHASE_WEIGHTS.startingFrom),
      "STARTING",
      "Subindo o container do OWASP ZAP...",
    );
    await sleep(2000);
  }
}

/** Retenta apenas leituras; ações podem ter sido aceitas mesmo sem resposta. */
async function zapCall(ctx: RealScanContext, endpoint: string, params: Record<string, string> = {}): Promise<Record<string, unknown>> {
  const attempts = endpoint.includes("/view/") ? readBoundedNumber(EnvKeys.DAST_ZAP_HTTP_ATTEMPTS, 3, 1, 5) : 1;
  for (let attempt = 1; ; attempt++) {
    assertStillRunning(ctx);
    ctx.lastEndpoint = endpoint;
    try {
      return await withKeepAlive(zapJson(ctx.baseUrl, endpoint, { ...params, apikey: ctx.apiKey },
        Math.max(1, Math.min(readBoundedNumber(EnvKeys.DAST_ZAP_HTTP_TIMEOUT_MS, 45000, 1000, 60000), ctx.deadline - Date.now())), ctx.signal),
        () => ctx.report(ctx.progress.percent, ctx.progress.phase, "Aguardando resposta do OWASP ZAP..."));
    } catch (error) {
      assertStillRunning(ctx);
      const code = (error as Error).message;
      if (attempt >= attempts || !/^(ZAP_HTTP_TIMEOUT|ECONNRESET|ECONNREFUSED|EAI_AGAIN|ZAP_HTTP_50[234])$/.test(code)) throw error;
      ctx.report(ctx.progress.percent, ctx.progress.phase, `Reconectando ao OWASP ZAP (${attempt + 1}/${attempts})...`);
      await sleep(500 * attempt);
    }
  }
}

function readBoundedNumber(key: EnvKeys, fallback: number, min: number, max: number): number {
  const parsed = Number(EnvVar.getOptional(key, String(fallback)));
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, Math.floor(parsed))) : fallback;
}

/** Origem + subárvore explícitas, sem query, credenciais ou ações conhecidas. */
export function isBaselineUrlAllowed(candidate: URL, target: URL): boolean {
  const root = target.pathname.endsWith("/") ? target.pathname : target.pathname + "/";
  return candidate.origin === target.origin && !candidate.username && !candidate.password && !candidate.search
    && (candidate.pathname === target.pathname || candidate.pathname.startsWith(root))
    && !/(?:logout|signout|delete|remove|unsubscribe|checkout|purchase|comprar|excluir|sair)/i.test(candidate.pathname.replace(/%([0-9a-f]{2})/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16))));
}

/**
 * O contexto é um filtro ANTES do tráfego do Spider, não um filtro do relatório.
 * A regex Java usa âncoras para não confundir origem/porta ou /app com /app2;
 * ações sensíveis também são excluídas quando escritas com bytes percentuais.
 * Consumidores: configuração do ZAP e testes de confinamento da descoberta.
 */
export function buildBaselineScopeRegex(target: URL): string {
  const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const root = target.pathname.endsWith("/") ? target.pathname : target.pathname + "/";
  const hexPattern = (value: string) => [...value].map((character) => /[a-f]/.test(character) ? `[${character}${character.toUpperCase()}]` : character).join("");
  const sensitive = ["logout", "signout", "delete", "remove", "unsubscribe", "checkout", "purchase", "comprar", "excluir", "sair"]
    .map((word) => [...word].map((letter) => `(?:[${letter}${letter.toUpperCase()}]|%${hexPattern(letter.charCodeAt(0).toString(16))}|%${hexPattern(letter.toUpperCase().charCodeAt(0).toString(16))})`).join(""))
    .join("|");
  return `^${escapeRegex(target.origin)}(?![^?#]*(?:${sensitive}))(?:${escapeRegex(target.pathname)}|${escapeRegex(root)}[^?#]*)$`;
}

/** Checa conectividade antes de iniciar descoberta; redirects não escapam do alvo autorizado. */
async function checkBaselineTarget(ctx: RealScanContext, target: URL): Promise<void> {
  const result = await zapCall(ctx, "/JSON/core/action/accessUrl/", { url: target.href, followRedirects: "false" });
  const messages = result.accessUrl as { responseHeader?: string }[] | undefined;
  if (!Array.isArray(messages) || !messages.length) throw new Error("TARGET_UNREACHABLE");
  const header = messages[0].responseHeader ?? "";
  const status = Number(/^HTTP\/\S+\s+(\d+)/.exec(header)?.[1] ?? 0);
  if (status < 100 || status >= 400) throw new Error(status ? `TARGET_HTTP_${status}` : "TARGET_UNREACHABLE");
  if (status >= 300) {
    const location = /^location:\s*(.+)$/im.exec(header)?.[1]?.trim();
    if (location) {
      let allowed = false;
      try { allowed = isBaselineUrlAllowed(new URL(location, target), target); } catch { /* inválido */ }
      if (!allowed) throw new Error("TARGET_REDIRECT_OUT_OF_SCOPE");
    }
  }
}

/**
 * Spider tradicional: usa os parsers do ZAP para links, recursos, robots e sitemap.
 * Profundidade 2, até 30 filhos POR NÓ, uma thread e prazo de 1..10 minutos;
 * esses limites não representam um teto global de páginas. Forms/POST desligados.
 * O Spider resolve redirects pelo filtro do contexto e não executa JavaScript.
 */
async function runBaselinePhase(ctx: RealScanContext, targetUrl: string, scanDir: string): Promise<void> {
  const target = new URL(targetUrl);
  if (!isBaselineUrlAllowed(target, target)) throw new Error("TARGET_UNSAFE_PATH");
  const contextName = "vulnera-baseline";
  const context = await zapCall(ctx, "/JSON/context/action/newContext/", { contextName });
  await zapCall(ctx, "/JSON/context/action/includeInContext/", { contextName, regex: buildBaselineScopeRegex(target) });
  await zapCall(ctx, "/JSON/context/action/setContextInScope/", { contextName, booleanInScope: "true" });
  if (!context.contextId) throw new Error("ZAP_BAD_RESPONSE:context");
  await zapCall(ctx, "/JSON/core/action/setMode/", { mode: "protect" });
  ctx.report(8, "SPIDER", "Verificando acesso ao alvo...");
  await checkBaselineTarget(ctx, target);

  const durationMin = getSpiderMaxDurationMin();
  const numericOptions = { MaxDuration: durationMin, MaxDepth: 2, MaxChildren: 30, ThreadCount: 1, MaxParseSizeBytes: 1000000 };
  for (const [option, value] of Object.entries(numericOptions)) {
    await zapCall(ctx, `/JSON/spider/action/setOption${option}/`, { Integer: String(value) });
  }
  // O padrão do Spider submete forms: desabilitar só POST ainda permitiria GET forms.
  const booleanOptions = { ProcessForm: false, PostForm: false, LogoutAvoidance: true, ParseRobotsTxt: true, ParseSitemapXml: true, ParseGit: false, ParseSVNEntries: false, ParseDsStore: false };
  for (const [option, value] of Object.entries(booleanOptions)) {
    await zapCall(ctx, `/JSON/spider/action/setOption${option}/`, { Boolean: String(value) });
  }
  const spiderDeadline = Math.min(ctx.deadline, Date.now() + durationMin * 60000);
  // O contexto do ZAP compara a URL sem query; a exclusão própria do Spider
  // impede que links com parâmetros sejam requisitados antes de filtrar resultados.
  await zapCall(ctx, "/JSON/spider/action/excludeFromScan/", { regex: ".*\\?.*" });

  const started = await zapCall(ctx, "/JSON/spider/action/scan/", {
    url: target.href, contextName, maxChildren: "30", recurse: "false", subtreeOnly: "true",
  });
  if (typeof started.scan !== "string" || !/^\d+$/.test(started.scan)) throw new Error("ZAP_BAD_RESPONSE:spider_scan");
  const scanId = started.scan;
  ctx.report(8, "SPIDER", "Descobrindo endpoints com o Spider tradicional...");
  for (;;) {
    assertStillRunning(ctx);
    const status = await zapCall(ctx, "/JSON/spider/view/status/", { scanId });
    const percent = Number(status.status);
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) throw new Error("ZAP_BAD_RESPONSE:spider_status");
    ctx.report(8 + percent * 0.65, "SPIDER", `Spider tradicional: ${percent}%`);
    if (percent === 100) break;
    if (Date.now() >= spiderDeadline) {
      // Sem resultado completo após o prazo: parar o motor e preservar FAILED.
      await zapCall(ctx, "/JSON/spider/action/stop/", { scanId });
      throw new Error("ZAP_SPIDER_TIMEOUT");
    }
    await sleep(Math.max(1, Math.min(ZAP_POLL_INTERVAL_MS, spiderDeadline - Date.now())));
  }
  const results = await zapCall(ctx, "/JSON/spider/view/results/", { scanId });
  if (!Array.isArray(results.results) || results.results.some((url) => typeof url !== "string")) throw new Error("ZAP_BAD_RESPONSE:spider_results");
  const urls = [...new Set((results.results as string[]).flatMap((raw) => {
    try {
      const discovered = new URL(raw);
      discovered.hash = "";
      return isBaselineUrlAllowed(discovered, target) ? [discovered.href] : [];
    } catch { return []; }
  }))].sort();
  // Evidência interna, sem chave da API ou URLs de terceiros descobertas no HTML.
  await fs.writeFile(path.join(scanDir, "discovery.json"), JSON.stringify({
    profile: "TRADITIONAL_SPIDER_PASSIVE",
    engine: "OWASP_ZAP",
    targetUrl: target.href,
    discoveredAt: new Date().toISOString(),
    urls,
    limits: { maxDurationMin: durationMin, maxDepth: 2, maxChildrenPerNode: 30, threadCount: 1, maxParseSizeBytes: 1000000 },
    processForms: false,
    javascript: false,
    activeScan: false,
  }, null, 2), "utf-8");
  ctx.report(73, "SPIDER", `Spider tradicional concluído: ${urls.length} URLs descobertas no escopo.`);
}

/** Só publica relatório completo quando a fila passiva esvaziar. */
async function waitForPassiveScan(ctx: RealScanContext): Promise<void> {
  ctx.report(85, "PASSIVE", "Aguardando análise passiva...");
  const passiveDeadline = Math.min(ctx.deadline, Date.now() + 300000);
  for (;;) {
    assertStillRunning(ctx);
    const status = await zapCall(ctx, "/JSON/pscan/view/recordsToScan/");
    const remaining = Number(status.recordsToScan);
    if (!Number.isFinite(remaining)) throw new Error("ZAP_BAD_RESPONSE:passive");
    ctx.report(85, "PASSIVE", `Analisando respostas: ${remaining} na fila`);
    if (remaining === 0) return;
    if (Date.now() > passiveDeadline) throw new Error("ZAP_PASSIVE_TIMEOUT");
    await sleep(ZAP_POLL_INTERVAL_MS);
  }
}

/**
 * Baixa report.json/report.html pela API do ZAP e grava no disco de QUEM RODA
 * A API. Nenhum volume compartilhado no meio — é este ponto que resolve a
 * "Causa 3" do docs/DAST-DOCKER-GAP.md.
 */
async function readZapReport(ctx: RealScanContext, endpoint: string): Promise<ZapHttpResponse> {
  const attempts = readBoundedNumber(EnvKeys.DAST_ZAP_HTTP_ATTEMPTS, 3, 1, 5);
  for (let attempt = 1; ; attempt++) {
    assertStillRunning(ctx);
    ctx.lastEndpoint = endpoint;
    try {
      const response = await httpGet(buildZapUrl(ctx.baseUrl, endpoint, { apikey: ctx.apiKey }), Math.max(1, Math.min(120000, ctx.deadline - Date.now())), ctx.signal);
      if ([502, 503, 504].includes(response.status)) throw new Error(`ZAP_HTTP_${response.status}`);
      return response;
    } catch (error) {
      assertStillRunning(ctx);
      if (attempt >= attempts || !/^(ZAP_HTTP_TIMEOUT|ECONNRESET|ECONNREFUSED|EAI_AGAIN|ZAP_HTTP_50[234])$/.test((error as Error).message)) throw error;
      await sleep(500 * attempt);
    }
  }
}

async function downloadReports(ctx: RealScanContext, scanDir: string): Promise<{ jsonPath: string; htmlPath?: string }> {
  ctx.report(PHASE_WEIGHTS.activeTo, "REPORT", "Gerando relatórios...");

  const jsonPath = path.join(scanDir, "report.json");
  const htmlPath = path.join(scanDir, "report.html");

  const jsonResponse = await withKeepAlive(
    readZapReport(ctx, "/OTHER/core/other/jsonreport/"),
    () => ctx.report(PHASE_WEIGHTS.activeTo, "REPORT", "Gerando relatórios (alvo grande, isso leva um tempo)..."),
  );
  if (jsonResponse.status !== 200) throw new Error(`ZAP_REPORT_HTTP_${jsonResponse.status}`);
  try {
    JSON.parse(jsonResponse.body);
  } catch {
    throw new Error("REPORT_JSON_INVALID");
  }
  await fs.writeFile(jsonPath, jsonResponse.body, "utf-8");

  // HTML é conveniência (o PDF e a lista de findings saem do JSON): falhar
  // aqui não derruba o scan.
  let savedHtml: string | undefined;
  try {
    const htmlResponse = await withKeepAlive(
      readZapReport(ctx, "/OTHER/core/other/htmlreport/"),
      () => ctx.report(PHASE_WEIGHTS.activeTo, "REPORT", "Gerando o relatório HTML do ZAP..."),
    );
    if (htmlResponse.status === 200 && htmlResponse.body.length > 0) {
      await fs.writeFile(htmlPath, htmlResponse.body, "utf-8");
      savedHtml = htmlPath;
    }
  } catch {
    savedHtml = undefined;
  }

  return { jsonPath, htmlPath: savedHtml };
}

/** Porta livre no loopback do host — pergunta ao SO em vez de chutar um número. */
function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address !== null ? address.port : 0;
      server.close(() => (port > 0 ? resolve(port) : reject(new Error("ZAP_PORT_UNRESOLVED"))));
    });
  });
}

/**
 * Decide em que porta o ZAP escuta e em que endereço ESTE processo o alcança.
 *
 * ⚠️ ARMADILHA QUE CUSTOU UMA SESSÃO: o ZAP em modo daemon é um PROXY antes de
 * ser um servidor de API. Ele só entende a requisição como "para mim" quando o
 * header `Host` bate com o endereço E A PORTA em que ele mesmo escuta —
 * qualquer outra coisa ele tenta encaminhar, e devolve `502 Bad Gateway`.
 * Publicar `-p 127.0.0.1::8080` (porta efêmera no host) portanto NÃO funciona:
 * a requisição chega com `Host: 127.0.0.1:50866` e o ZAP tenta proxiar pra si
 * mesmo na 50866, onde não há ninguém.
 *
 * As duas saídas, uma por modo:
 *  - Rede do compose: API e ZAP na mesma rede, endereço `http://<container>:8080`
 *    — a porta 8080 é a mesma dos dois lados, então bate.
 *  - Host: escolhe UMA porta livre e usa a MESMA dentro e fora
 *    (`-p 127.0.0.1:P:P` + `zap.sh -port P`).
 */
async function resolveZapEndpoint(containerName: string, network: string): Promise<{ port: number; baseUrl: string }> {
  if (network) return { port: ZAP_INTERNAL_PORT, baseUrl: `http://${containerName}:${ZAP_INTERNAL_PORT}` };
  const port = await findFreePort();
  return { port, baseUrl: `http://127.0.0.1:${port}` };
}

async function runRealScan(
  scanId: string,
  targetUrl: string,
  timeoutMs: number,
  onProgress?: (progress: ScanProgress) => void,
  signal?: AbortSignal,
): Promise<ScanOutcome> {
  const scanDir = path.resolve(getReportsDir(), scanId);
  await fs.mkdir(scanDir, { recursive: true });

  const containerName = containerNameFor(scanId);
  const network = getZapNetwork();
  const { port: zapPort, baseUrl } = await resolveZapEndpoint(containerName, network);
  // Chave por scan, nunca `api.disablekey=true`: quem alcançar a porta do
  // daemon sem a chave não dispara nada.
  const apiKey = randomBytes(16).toString("hex");
  const started = Date.now();
  const deadline = started + timeoutMs;

  const progress: ScanProgress = { percent: 0, phase: "STARTING", message: "" };
  const report = (percent: number, phase: ScanPhase, message: string): void => {
    Object.assign(progress, { percent: Math.max(progress.percent, clampPercent(percent)), phase, message });
    onProgress?.({ ...progress });
  };

  report(1, "STARTING", "Preparando o container do OWASP ZAP...");

  const runArgs = ["run", "-d", "--name", containerName];

  // Teto de recurso POR CONTAINER — o watchdog limita quantos scans rodam,
  // isto limita quanto cada um come. Ver getZapMemory() pro racional e pra
  // medição que motivou os dois limites.
  const memoryLimit = getZapMemory();
  const heapArg = heapArgForMemoryLimit(memoryLimit);
  if (heapArg) {
    // --memory-swap igual a --memory desliga o swap: sem isso o container
    // "cabe" no limite paginando pra disco e o scan fica absurdamente lento
    // em vez de falhar rápido.
    runArgs.push("--memory", memoryLimit, "--memory-swap", memoryLimit);
  }
  const cpus = getZapCpus();
  if (cpus && Number.isFinite(Number(cpus)) && Number(cpus) > 0) {
    runArgs.push("--cpus", cpus);
  }

  if (network) {
    runArgs.push("--network", network);
  } else {
    // Presa ao loopback — nunca 0.0.0.0: o daemon do ZAP não pode ficar
    // exposto na rede da máquina. Mesma porta dos dois lados (ver
    // resolveZapEndpoint).
    runArgs.push("-p", `127.0.0.1:${zapPort}:${zapPort}`);
  }
  runArgs.push(getZapImage(), "zap.sh");
  // -Xmx é consumido pelo PRÓPRIO zap.sh (ele o retira dos args antes de
  // repassar pro ZAP) e sobrescreve o heap que ele calcularia sozinho — que
  // seria errado aqui, porque o zap.sh lê a RAM do host, não o limite do
  // cgroup. Ver heapArgForMemoryLimit().
  if (heapArg) runArgs.push(heapArg);
  runArgs.push(
    "-daemon",
    "-host",
    "0.0.0.0",
    "-port",
    String(zapPort),
    // Sem isto o daemon só aceita chamada vinda do localhost DELE mesmo — e
    // quem chama é outro container (ou o host, via porta publicada).
    "-config",
    "api.addrs.addr.name=.*",
    "-config",
    "api.addrs.addr.regex=true",
    "-config",
    `api.key=${apiKey}`,
    // -silent corta telemetria e checagem de add-on na subida (mais rápido e
    // sem depender de rede externa pra ficar pronto).
    "-silent",
  );

  // Timeout de 10min (não 3): quando a imagem do ZAP ainda não está local, o
  // `docker run` faz o pull de ~3.7GB antes de subir o container. Em 3min uma
  // conexão doméstica não termina esse download, e o scan falhava com
  // ZAP_CONTAINER_START_FAILED sem explicar que o problema era só o primeiro
  // uso da máquina. O keep-alive abaixo mantém o watchdog informado no meio.
  const runResult = await withKeepAlive(runDocker(runArgs, { timeout: 600000 }), () =>
    report(2, "STARTING", "Baixando/preparando a imagem do OWASP ZAP (pode demorar no primeiro uso)..."),
  );
  if (runResult.code !== 0) {
    const detail = runResult.stderr.trim().slice(0, 500) || `docker run saiu com código ${runResult.code ?? "desconhecido"}`;
    console.warn(`[DAST] container start failed: ${detail.replaceAll(apiKey, "[REDACTED]")}`);
    await killContainer(scanId);
    return {
      status: "FAILED",
      errorMessage: "ZAP_CONTAINER_START_FAILED",
      durationMs: Date.now() - started,
      simulated: false,
    };
  }

  const ctx: RealScanContext = { baseUrl, apiKey, deadline, signal, report, progress };

  try {
    await waitForZapReady(ctx, Math.min(deadline, started + getStartupTimeoutMs()));

    await runBaselinePhase(ctx, targetUrl, scanDir);
    await waitForPassiveScan(ctx);

    const { jsonPath, htmlPath } = await downloadReports(ctx, scanDir);
    assertStillRunning(ctx);
    report(100, "DONE", "Scan concluído.");

    return {
      status: "COMPLETED",
      jsonReportPath: jsonPath,
      htmlReportPath: htmlPath,
      durationMs: Date.now() - started,
      simulated: false,
    };
  } catch (error) {
    const original = (error as Error).message || "ZAP_UNKNOWN_ERROR";
    const diagnosed = original === "SCAN_CANCELLED" ? original : await describeContainerDeath(containerName, original);
    const logs = await runDocker(["logs", "--tail", "150", containerName], { timeout: 5000 });
    const safeLog = (logs.stdout + logs.stderr).replaceAll(apiKey, "[REDACTED]");
    let reason = diagnosed;
    if (original !== "SCAN_CANCELLED" && /OutOfMemoryError|Java heap space/.test(safeLog)) {
      reason = "ZAP_JAVA_OUT_OF_MEMORY";
    } else if (original !== "SCAN_CANCELLED" && diagnosed === original && ctx.lastEndpoint === "/JSON/core/action/accessUrl/" &&
      /(?:HostConnect|UnknownHost|SocketTimeout|SSLHandshake)Exception/.test(safeLog)) {
      reason = "TARGET_UNREACHABLE";
    }
    await fs.writeFile(path.join(scanDir, "diagnostics.json"), JSON.stringify({
      phase: progress.phase, endpoint: ctx.lastEndpoint, reason, memoryLimit, cpus,
      elapsedMs: Date.now() - started, log: safeLog.slice(-16000),
    }, null, 2)).catch(() => undefined);
    console.warn(`[DAST] ${scanId} phase=${progress.phase} endpoint=${ctx.lastEndpoint ?? "startup"} error=${reason}`);
    return {
      status: "FAILED",
      // Um container morto por estourar `--memory` derruba o daemon do ZAP, e
      // o sintoma que chega aqui é uma falha de conexão genérica — que não diz
      // nada a quem lê. Como o limite de RAM é NOSSO (ver getZapMemory()), a
      // causa precisa aparecer com nome, senão vira um "erro estranho" sem
      // pista de que a saída é aumentar DAST_ZAP_MEMORY.
      errorMessage: reason,
      durationMs: Date.now() - started,
      simulated: false,
    };
  } finally {
    // O container é cliente/servidor: matar o processo Node não mata o
    // container. `docker rm -f` é a única forma confiável — `--rm` só limpa
    // depois que ele PARA sozinho.
    await killContainer(scanId);
  }
}

/**
 * Pergunta ao Docker COMO o container morreu, e troca o erro genérico por um
 * que aponta a causa quando ela é conhecida.
 *
 * Só existe por causa do `--memory`: antes dele o container não morria por
 * limite nenhum, e um erro de conexão só podia ser rede ou o ZAP travando.
 * Agora "conexão recusada" pode ser OOM — e a saída (subir
 * `DAST_ZAP_MEMORY`) é acionável, mas invisível sem esta checagem.
 *
 * Best-effort de propósito: se o `docker inspect` falhar (o container já foi
 * removido, o daemon caiu), devolve o erro original em vez de mascará-lo.
 */
async function describeContainerDeath(containerName: string, originalError: string): Promise<string> {
  try {
    const inspect = await runDocker(["inspect", "--format", "{{.State.OOMKilled}}|{{.State.ExitCode}}", containerName], { timeout: 5000 });
    if (inspect.code !== 0) return originalError;
    const [oomKilled] = inspect.stdout.trim().split("|");
    if (oomKilled === "true") return "ZAP_OOM_KILLED";
    return originalError;
  } catch {
    return originalError;
  }
}

/** `docker rm -f` no container determinístico do scan — cancelamento e limpeza de timeout usam a mesma função. */
export async function killContainer(scanId: string): Promise<void> {
  await runDocker(["rm", "-f", containerNameFor(scanId)], { timeout: 10000 });
  // Não lança em "No such container": outro caminho pode já ter limpado.
  // cancel() no service de negócio é best-effort por design — quem chama já
  // marca CANCELLED no banco independente do resultado aqui.
}

// ============================================================================
// Demonstração explicitamente solicitada — nenhum acesso ao Docker/alvo
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
      // descarte por escopo do pipeline (Fase 3) mesmo na demonstração.
      instances: [instance("/api/status"), externalInstance],
    }),
  ];
}

/**
 * `timeoutMs` opcional deixa a demonstração honrar o MESMO contrato de
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
    "@programName": "ZAP (demonstração solicitada)",
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
<h1>ZAP Scanning Report — SIMULADO (demonstração solicitada)</h1>
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

/** Mensagem tratada; códigos técnicos ficam separados de segredos/stack. */
export function friendlyFailureReason(errorMessage: string | undefined): string {
  const code = errorMessage ?? "UNKNOWN";
  if (code === "DOCKER_UNAVAILABLE") return "O Docker não está acessível. Abra o Docker Desktop e tente novamente.";
  if (code === "REAL_SCAN_DISABLED") return "O ambiente está configurado para demonstração. Desative DAST_FORCE_SIMULATE para permitir scans reais.";
  if (/ZAP_OOM_KILLED|ZAP_JAVA_OUT_OF_MEMORY/.test(code)) return "O OWASP ZAP ficou sem memória. Execute um scan por vez, reduza o escopo ou aumente a memória disponível para Docker/ZAP.";
  if (code === "TARGET_REDIRECT_OUT_OF_SCOPE") return "O alvo redireciona para fora do escopo permitido. Informe diretamente a URL final autorizada.";
  if (code === "TARGET_UNSAFE_PATH") return "Este perfil aceita URLs sem parâmetros e bloqueia caminhos de ações sensíveis. Escolha uma página de leitura.";
  if (code.startsWith("TARGET_HTTP_")) return `O alvo respondeu HTTP ${code.slice(12)}. Verifique a URL, autenticação e bloqueios de acesso antes de tentar novamente.`;
  if (code === "TARGET_UNREACHABLE" || /ZAP_API_ERROR:(url_not_found|failed_to_access_url|io_error)/.test(code)) return "O ZAP não conseguiu alcançar o alvo. Verifique DNS, endereço/porta, certificado TLS, firewall e acesso pela rede do Docker.";
  if (code === "TARGET_ACCESS_FAILED") return "O ZAP falhou ao acessar o alvo. Verifique endereço/porta e acesso pela rede Docker; o diagnóstico da execução contém a causa retornada pelo motor.";
  if (code === "ZAP_HTTP_TIMEOUT") return "O OWASP ZAP não respondeu dentro do prazo. As consultas de leitura têm tentativas limitadas; comandos de navegação não são repetidos automaticamente. Verifique recursos e conectividade e tente novamente.";
  if (/ECONNREFUSED|ECONNRESET|EAI_AGAIN|ENOTFOUND/.test(code)) return "A comunicação com o container do ZAP foi interrompida. Verifique a rede Docker e se o processo continua disponível.";
  if (code === "SCAN_TIMEOUT") return "O scan ultrapassou o tempo máximo. Reduza o escopo e verifique os recursos disponíveis antes de tentar novamente.";
  if (code === "SCAN_CANCELLED") return "A execução foi interrompida.";
  if (code === "ZAP_PASSIVE_TIMEOUT") return "A análise passiva não terminou no prazo; nenhum relatório completo foi publicado. Reduza o escopo ou disponibilize mais recursos.";
  if (code === "ZAP_SPIDER_TIMEOUT") return "O Spider tradicional não concluiu a descoberta no prazo configurado; nenhum relatório completo foi publicado. Reduza o escopo ou aumente o tempo de descoberta.";
  if (code === "ZAP_STARTUP_TIMEOUT") return "O OWASP ZAP não terminou de iniciar no prazo. Confira memória, CPU e a imagem Docker.";
  if (code.startsWith("ZAP_CONTAINER_START_FAILED")) return "O container do OWASP ZAP não subiu. Verifique a imagem, a rede Docker e as permissões da API.";
  if (code === "REPORT_JSON_INVALID") return "O relatório gerado pelo OWASP ZAP veio corrompido. Tente uma nova execução.";
  if (code === "ZAP_RESPONSE_TOO_LARGE") return "A resposta excedeu o limite de tamanho. Reduza o escopo do scan.";
  if (code.startsWith("ZAP_API_ERROR")) return "O OWASP ZAP recusou o comando. Consulte o diagnóstico da execução e confira a versão da imagem.";
  return "Não foi possível concluir a execução do OWASP ZAP. Consulte o diagnóstico salvo para este scan.";
}

/** Escolha explícita: demonstração não consulta Docker nem faz tráfego ao alvo. */
export async function runScan(options: RunScanOptions): Promise<ScanOutcome> {
  const timeoutMs = options.timeoutMs ?? getTimeoutMs();
  if (options.signal?.aborted) return { status: "FAILED", simulated: options.mode === "SIMULATED", durationMs: 0, errorMessage: "SCAN_CANCELLED" };
  if (options.mode === "SIMULATED") {
    const outcome = await simulateScan(options.scanId, options.targetUrl, timeoutMs);
    if (outcome.status === "COMPLETED") options.onProgress?.({ percent: 100, phase: "SIMULATED", message: "Demonstração gerada." });
    return { ...outcome, warningMessage: "Demonstração solicitada: o OWASP ZAP não foi executado e o alvo não recebeu requisições. Estes achados são fictícios." };
  }
  if (options.mode !== "REAL") throw new Error("INVALID_SCAN_MODE");
  if (EnvVar.getOptional(EnvKeys.DAST_FORCE_SIMULATE, "false").toLowerCase() === "true") {
    return { status: "FAILED", simulated: false, durationMs: 0, errorMessage: "REAL_SCAN_DISABLED" };
  }
  if (!(await isDockerAvailable())) return { status: "FAILED", simulated: false, durationMs: 0, errorMessage: "DOCKER_UNAVAILABLE" };
  return runRealScan(options.scanId, options.targetUrl, timeoutMs, options.onProgress, options.signal);
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

export const __internal = { getReportsDir, getTimeoutMs, getZapNetwork, getZapImage, getStartupTimeoutMs, getSpiderMaxDurationMin };
