/**
 * zap-runner.service.ts
 *
 * Motor de execução do scan DAST. Sobe UM container do OWASP ZAP por scan
 * (`docker run -d`), em MODO DAEMON/PROXY, e conduz o scan falando com a API
 * HTTP do próprio ZAP (spider -> passivo -> active scan -> relatórios).
 *
 * ⚠️ MUDANÇA DE 2026-09-09 — antes daqui o runner chamava `zap-full-scan.py`
 * dentro do container e lia `report.json` de um volume compartilhado. Dois
 * problemas mataram esse desenho:
 *
 *  1. PROGRESSO. `zap-full-scan.py` é uma caixa preta: só devolve texto no
 *     stdout no final. Não dá pra saber que o spider está em 40%. A API do
 *     ZAP em modo daemon devolve percentual REAL por fase
 *     (/JSON/spider/view/status/ e /JSON/ascan/view/status/) — é isso que
 *     alimenta a barra de progresso da UI.
 *  2. VOLUME. Com a API rodando DENTRO de um container (docker compose), o
 *     caminho passado em `-v` era interpretado pelo daemon do HOST, não pelo
 *     filesystem do container da API: o ZAP escrevia o relatório num lugar
 *     que a API nunca leria (diagnóstico completo em docs/DAST-DOCKER-GAP.md
 *     §3, "Causa 3"). Buscando os relatórios pela API HTTP do ZAP
 *     (/OTHER/core/other/jsonreport/) o bind mount some do desenho inteiro —
 *     quem escreve no disco é o processo Node, no caminho que ele mesmo lê.
 *
 * Por que não é uma classe com injeção de dependência como os outros services
 * (CLAUDE.md §5.3): este módulo NÃO toca o Prisma — não sabe o que é um
 * DastScan, não marca status, não grava nada no banco. Só executa o processo
 * e devolve um resultado descritivo. Quem orquestra (cria o registro QUEUED,
 * decide RUNNING/COMPLETED/FAILED, aciona o pipeline de findings) é o
 * `dast-scan.service.ts`, e quem limita a concorrência é o
 * `dast-watchdog.service.ts` — mesma separação que `push.util.ts` já usa.
 * Mantém a regra do CLAUDE.md de que só Repository importa `@prisma/client`.
 *
 * SEGURANÇA (ver docs/DAST.md §5 pra detalhe de cada item):
 *  - `execFile`, NUNCA `exec`/`shell:true` — argumentos vão como array pro
 *    processo, nunca interpolados numa string de shell. Uma targetUrl com
 *    `; rm -rf /` vira só um argumento de URL inválido, nunca um comando.
 *  - `validateTargetUrl` bloqueia protocolo != http/https e, por padrão,
 *    loopback/faixas privadas (SSRF) — liberável via DAST_ALLOW_PRIVATE_TARGETS.
 *  - `resolveReportPath` impede path traversal ao servir report.html/json.
 *  - A API do ZAP sobe com uma `api.key` ALEATÓRIA por scan (nunca
 *    `api.disablekey=true`): mesmo que alguém alcance a porta do daemon, sem
 *    a chave não dispara scan nenhum. Quando a API roda no host, a porta é
 *    publicada só em 127.0.0.1, nunca em 0.0.0.0.
 *
 * ⚠️ Limitação conhecida: a checagem de host privado é sobre o LITERAL da URL
 * (hostname/IP escrito), não sobre DNS resolvido. Um hostname público que só
 * resolve pra IP privado em tempo de requisição (DNS rebinding) não é pego
 * aqui — documentado em docs/DAST.md §10, fora de escopo desta entrega.
 *
 * Fallback simulado (`simulateScan`): gera report.json/report.html estáticos
 * com ~8 alertas representativos. Aciona em DOIS casos — Docker indisponível
 * (CI, Docker Desktop fechado) e scan real que FALHOU. No segundo caso o
 * resultado simulado é mantido de propósito, com `warningMessage` amigável e
 * `simulated: true` gravados no banco: a tela nunca fica vazia, e nunca
 * finge que o dado é real (era exatamente o buraco de produto apontado em
 * docs/DAST-DOCKER-GAP.md §5).
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
  const parsed = Number(EnvVar.getOptional(EnvKeys.DAST_ZAP_SPIDER_MAX_DURATION_MIN, "5"));
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 5;
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
  return EnvVar.getOptional(EnvKeys.DAST_ZAP_CPUS, "4").trim();
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
  /** Aviso amigável quando CONCLUIU com ressalva (tipicamente o fallback simulado). */
  warningMessage?: string;
  durationMs: number;
  simulated: boolean;
}

export interface RunScanOptions {
  scanId: string;
  targetUrl: string;
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

function httpGet(url: string, timeoutMs: number): Promise<ZapHttpResponse> {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout: timeoutMs }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf-8") }));
      res.on("error", reject);
    });
    // "timeout" só avisa que o socket ficou ocioso — quem encerra a requisição
    // é o destroy(); sem ele a promise ficaria pendurada pra sempre.
    req.on("timeout", () => req.destroy(new Error("ZAP_HTTP_TIMEOUT")));
    req.on("error", reject);
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
  timeoutMs = 20000,
): Promise<Record<string, unknown>> {
  const response = await httpGet(buildZapUrl(baseUrl, endpoint, params), timeoutMs);
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(response.body) as Record<string, unknown>;
  } catch {
    throw new Error(`ZAP_BAD_RESPONSE:${endpoint}:${response.body.slice(0, 200)}`);
  }
  if (typeof parsed.code === "string") {
    throw new Error(`ZAP_API_ERROR:${parsed.code}:${String(parsed.message ?? "").slice(0, 200)}`);
  }
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
      const version = await zapJson(ctx.baseUrl, "/JSON/core/view/version/", { apikey: ctx.apiKey }, 5000);
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

/** Dispara o spider e acompanha até 100%. Devolve quantas URLs entraram na árvore. */
async function runSpiderPhase(ctx: RealScanContext, targetUrl: string): Promise<number> {
  const maxDuration = getSpiderMaxDurationMin();
  if (maxDuration > 0) {
    await zapJson(ctx.baseUrl, "/JSON/spider/action/setOptionMaxDuration/", {
      apikey: ctx.apiKey,
      Integer: String(maxDuration),
    });
  }

  const started = await zapJson(ctx.baseUrl, "/JSON/spider/action/scan/", {
    apikey: ctx.apiKey,
    url: targetUrl,
    recurse: "true",
  });
  const spiderId = String(started.scan ?? "0");

  for (;;) {
    assertStillRunning(ctx);
    const status = await zapJson(ctx.baseUrl, "/JSON/spider/view/status/", { apikey: ctx.apiKey, scanId: spiderId });
    const percent = Number(status.status ?? "0");
    ctx.report(
      PHASE_WEIGHTS.startingTo + (percent / 100) * (PHASE_WEIGHTS.spiderTo - PHASE_WEIGHTS.startingTo),
      "SPIDER",
      `Rastreando o alvo (spider): ${clampPercent(percent)}%`,
    );
    if (percent >= 100) break;
    await sleep(ZAP_POLL_INTERVAL_MS);
  }

  const results = await zapJson(ctx.baseUrl, "/JSON/spider/view/results/", { apikey: ctx.apiKey, scanId: spiderId });
  const urls = results.results;
  return Array.isArray(urls) ? urls.length : 0;
}

/**
 * Espera a fila do scanner PASSIVO drenar. Sem isso, o relatório sai antes de
 * os alertas passivos (headers ausentes, cookies sem flag) serem gravados —
 * justamente a maior parte dos achados de um alvo bem-comportado.
 */
async function waitForPassiveScan(ctx: RealScanContext): Promise<void> {
  const passiveDeadline = Math.min(ctx.deadline, Date.now() + 120000);
  let initialQueue = 0;

  for (;;) {
    assertStillRunning(ctx);
    const status = await zapJson(ctx.baseUrl, "/JSON/pscan/view/recordsToScan/", { apikey: ctx.apiKey });
    const remaining = Number(status.recordsToScan ?? "0");
    if (initialQueue === 0) initialQueue = remaining;

    const done = initialQueue === 0 ? 1 : Math.max(0, (initialQueue - remaining) / initialQueue);
    ctx.report(
      PHASE_WEIGHTS.spiderTo + done * (PHASE_WEIGHTS.passiveTo - PHASE_WEIGHTS.spiderTo),
      "PASSIVE",
      `Analisando respostas (scan passivo): ${remaining} na fila`,
    );

    if (remaining <= 0) return;
    // Estourar o orçamento passivo NÃO é falha: o active scan ainda produz
    // resultado válido, só sai com menos alerta passivo. Segue o baile.
    if (Date.now() > passiveDeadline) return;
    await sleep(ZAP_POLL_INTERVAL_MS);
  }
}

/** Dispara o active scan e acompanha até 100%. */
async function runActiveScanPhase(ctx: RealScanContext, targetUrl: string): Promise<void> {
  const started = await zapJson(ctx.baseUrl, "/JSON/ascan/action/scan/", {
    apikey: ctx.apiKey,
    url: targetUrl,
    recurse: "true",
    inScopeOnly: "false",
  });
  const ascanId = String(started.scan ?? "0");

  for (;;) {
    assertStillRunning(ctx);
    const status = await zapJson(ctx.baseUrl, "/JSON/ascan/view/status/", { apikey: ctx.apiKey, scanId: ascanId });
    const percent = Number(status.status ?? "0");
    ctx.report(
      PHASE_WEIGHTS.passiveTo + (percent / 100) * (PHASE_WEIGHTS.activeTo - PHASE_WEIGHTS.passiveTo),
      "ACTIVE",
      `Testando vulnerabilidades (scan ativo): ${clampPercent(percent)}%`,
    );
    if (percent >= 100) return;
    await sleep(ZAP_POLL_INTERVAL_MS);
  }
}

/**
 * Baixa report.json/report.html pela API do ZAP e grava no disco de QUEM RODA
 * A API. Nenhum volume compartilhado no meio — é este ponto que resolve a
 * "Causa 3" do docs/DAST-DOCKER-GAP.md.
 */
async function downloadReports(ctx: RealScanContext, scanDir: string): Promise<{ jsonPath: string; htmlPath?: string }> {
  ctx.report(PHASE_WEIGHTS.activeTo, "REPORT", "Gerando relatórios...");

  const jsonPath = path.join(scanDir, "report.json");
  const htmlPath = path.join(scanDir, "report.html");

  const jsonResponse = await withKeepAlive(
    httpGet(buildZapUrl(ctx.baseUrl, "/OTHER/core/other/jsonreport/", { apikey: ctx.apiKey }), 120000),
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
      httpGet(buildZapUrl(ctx.baseUrl, "/OTHER/core/other/htmlreport/", { apikey: ctx.apiKey }), 120000),
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

  const report = (percent: number, phase: ScanPhase, message: string): void => {
    onProgress?.({ percent: clampPercent(percent), phase, message });
  };

  report(1, "STARTING", "Preparando o container do OWASP ZAP...");

  const runArgs = ["run", "-d", "--rm", "--name", containerName];

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
    return {
      status: "FAILED",
      errorMessage: `ZAP_CONTAINER_START_FAILED: ${detail}`,
      durationMs: Date.now() - started,
      simulated: false,
    };
  }

  const ctx: RealScanContext = { baseUrl, apiKey, deadline, signal, report };

  try {
    await waitForZapReady(ctx, Math.min(deadline, started + getStartupTimeoutMs()));

    await runSpiderPhase(ctx, targetUrl);
    await waitForPassiveScan(ctx);
    await runActiveScanPhase(ctx, targetUrl);

    const { jsonPath, htmlPath } = await downloadReports(ctx, scanDir);
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
    return {
      status: "FAILED",
      // Um container morto por estourar `--memory` derruba o daemon do ZAP, e
      // o sintoma que chega aqui é uma falha de conexão genérica — que não diz
      // nada a quem lê. Como o limite de RAM é NOSSO (ver getZapMemory()), a
      // causa precisa aparecer com nome, senão vira um "erro estranho" sem
      // pista de que a saída é aumentar DAST_ZAP_MEMORY.
      errorMessage: original === "SCAN_CANCELLED" ? original : await describeContainerDeath(containerName, original),
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
    if (oomKilled === "true") return `ZAP_OOM_KILLED: ${originalError}`;
    return originalError;
  } catch {
    return originalError;
  }
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

/**
 * Mensagens amigáveis do fallback. Ficam AQUI, e não na UI, porque a UI só
 * recebe o texto já pronto pelo campo `warningMessage` do scan — assim o
 * mesmo aviso vale pra web, pro mobile e pro PDF sem duplicar tradução.
 */
export const FALLBACK_MESSAGES = {
  dockerUnavailable:
    "O Docker não está acessível neste ambiente, então o OWASP ZAP não pôde ser executado. " +
    "Os achados abaixo são um conjunto de demonstração — não representam o alvo informado.",
  forced:
    "Modo de demonstração ligado (DAST_FORCE_SIMULATE): o OWASP ZAP não foi executado. " +
    "Os achados abaixo são um conjunto de demonstração — não representam o alvo informado.",
  realScanFailed: (reason: string): string =>
    "O scan real do OWASP ZAP não pôde ser concluído, então exibimos um resultado de demonstração no lugar. " +
    `Motivo técnico: ${reason}`,
} as const;

/** Traduz o código técnico do runner numa frase curta que faz sentido pra quem só quer usar o produto. */
export function friendlyFailureReason(errorMessage: string | undefined): string {
  if (!errorMessage) return "falha desconhecida na execução do scan.";
  if (errorMessage === "SCAN_TIMEOUT") return "o scan ultrapassou o tempo máximo configurado.";
  if (errorMessage === "ZAP_STARTUP_TIMEOUT") return "o OWASP ZAP não terminou de subir dentro do tempo esperado.";
  if (errorMessage === "ZAP_PORT_UNRESOLVED") return "não foi possível descobrir a porta do container do OWASP ZAP.";
  if (errorMessage.startsWith("ZAP_CONTAINER_START_FAILED")) return "o container do OWASP ZAP não subiu (imagem ausente ou Docker sem permissão).";
  if (errorMessage.startsWith("ZAP_API_ERROR:url_not_found")) return "o alvo informado não respondeu ao OWASP ZAP.";
  if (errorMessage.startsWith("ZAP_API_ERROR")) return "o OWASP ZAP recusou o comando do scan.";
  if (errorMessage.startsWith("ZAP_BAD_RESPONSE")) return "o OWASP ZAP devolveu uma resposta inesperada.";
  if (errorMessage === "REPORT_JSON_INVALID") return "o relatório gerado pelo OWASP ZAP veio corrompido.";
  // Acionável de propósito: quem lê isto precisa saber que existe um botão a
  // girar (DAST_ZAP_MEMORY), não só que "algo deu errado".
  if (errorMessage.startsWith("ZAP_OOM_KILLED")) {
    return "o OWASP ZAP ficou sem memória neste alvo — aumente DAST_ZAP_MEMORY ou escaneie um escopo menor.";
  }
  if (errorMessage === "ZAP_HTTP_TIMEOUT") return "o OWASP ZAP parou de responder durante o scan.";
  return errorMessage.slice(0, 200);
}

/**
 * Decide real vs simulado e roda o scan até concluir, timeoutar ou falhar.
 *
 * Três caminhos, nesta ordem:
 *  1. DAST_FORCE_SIMULATE=true  -> simulado direto (CI e suíte de testes).
 *  2. Docker indisponível        -> simulado, com aviso amigável.
 *  3. Scan real                  -> se FALHAR, cai pro simulado MANTENDO o
 *     resultado (nunca deixa a tela vazia) e carimbando `simulated: true` +
 *     `warningMessage`. Cancelamento é a única falha que NÃO vira fallback:
 *     quem cancelou não quer resultado nenhum.
 */
export async function runScan(options: RunScanOptions): Promise<ScanOutcome> {
  const forceSimulate = EnvVar.getOptional(EnvKeys.DAST_FORCE_SIMULATE, "false").toLowerCase() === "true";
  const timeoutMs = options.timeoutMs ?? getTimeoutMs();

  if (forceSimulate) {
    const outcome = await simulateScan(options.scanId, options.targetUrl, timeoutMs);
    return withWarning(outcome, FALLBACK_MESSAGES.forced, options.onProgress);
  }

  if (!(await isDockerAvailable())) {
    console.warn(`[DAST] Docker indisponível — scan ${options.scanId} vai usar resultado simulado.`);
    const outcome = await simulateScan(options.scanId, options.targetUrl, timeoutMs);
    return withWarning(outcome, FALLBACK_MESSAGES.dockerUnavailable, options.onProgress);
  }

  const real = await runRealScan(options.scanId, options.targetUrl, timeoutMs, options.onProgress, options.signal);
  if (real.status === "COMPLETED") return real;
  if (real.errorMessage === "SCAN_CANCELLED") return real;

  console.warn(`[DAST] Scan real ${options.scanId} falhou (${real.errorMessage}) — caindo pro resultado simulado.`);
  // Sem timeoutMs de propósito: o orçamento de tempo já foi gasto pelo scan
  // real, e o ponto do fallback é SEMPRE entregar um resultado.
  const fallback = await simulateScan(options.scanId, options.targetUrl);
  return withWarning(
    { ...fallback, durationMs: real.durationMs + fallback.durationMs },
    FALLBACK_MESSAGES.realScanFailed(friendlyFailureReason(real.errorMessage)),
    options.onProgress,
  );
}

/** Carimba o aviso no resultado simulado e empurra o último tick de progresso pra UI. */
function withWarning(
  outcome: ScanOutcome,
  warningMessage: string,
  onProgress?: (progress: ScanProgress) => void,
): ScanOutcome {
  if (outcome.status === "FAILED") return outcome;
  onProgress?.({ percent: 100, phase: "SIMULATED", message: "Resultado simulado gerado." });
  return { ...outcome, warningMessage };
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

export const __internal = { getReportsDir, getTimeoutMs, allowPrivateTargets, getZapNetwork, getZapImage, getStartupTimeoutMs, getSpiderMaxDurationMin };
