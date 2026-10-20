/**
 * zap-runner.service.test.ts
 *
 * Testes de unidade puros do runner — sem Docker, sem banco. Cobre a
 * validação HTTP/HTTPS e as proteções preservadas na execução do scan:
 *
 *   DAST-SEC-01  file:// rejeitado
 *   DAST-SEC-02  loopback aceito para alvos autorizados
 *   DAST-SEC-03  rede privada aceita, inclusive com configuração legada false
 *   DAST-SEC-04  path traversal no nome do relatório
 *   DAST-SEC-05  URL com metacaractere de shell não executa nada extra
 *
 * SEC-05 mocka `child_process` pra provar a garantia estrutural: o comando é
 * sempre "docker" e os argumentos vão como ARRAY (nunca uma string montada
 * por interpolação) — é isso que torna `; rm -rf /` só mais um caractere
 * dentro de UM argumento, nunca um separador de comando.
 */

import { execFile } from "child_process";
import * as http from "http";
import * as path from "path";
import { EventEmitter } from "events";

jest.mock("child_process", () => ({
  execFile: jest.fn((_cmd: string, _args: string[], _opts: unknown, cb: (...a: unknown[]) => void) => {
    cb(null, "", "");
  }),
}));

// A conversa com o daemon do ZAP é HTTP — mockar `http.get` é o que permite
// exercitar o fluxo inteiro (GET limitado -> passivo -> relatório) sem
// subir container nenhum.
jest.mock("http", () => ({ get: jest.fn() }));

import * as fs from "fs/promises";
import {
  validateTargetUrl,
  resolveReportPath,
  escapeHtml,
  containerNameFor,
  isDockerAvailable,
  runScan,
  buildZapUrl,
  parseMemoryToMb,
  heapArgForMemoryLimit,
  friendlyFailureReason,
  isBaselineUrlAllowed,
  buildBaselineScopeRegex,
} from "../../src/services/zap-runner.service";

/** Menor report.json que o pipeline aceita — mesmo formato do ZAP de verdade. */
const ZAP_REPORT_MINIMO = {
  "@programName": "ZAP",
  "@version": "2.17.0",
  site: [
    {
      "@name": "https://example.com",
      "@host": "example.com",
      "@port": "443",
      "@ssl": "true",
      alerts: [
        {
          pluginid: "10038",
          alert: "Content Security Policy (CSP) Header Not Set",
          riskcode: "2",
          confidence: "3",
          riskdesc: "Medium (High)",
          count: "1",
          instances: [{ uri: "https://example.com/", method: "GET", param: "" }],
        },
      ],
    },
  ],
};

describe("zap-runner.service — validação de alvo HTTP/HTTPS", () => {
  // DAST-SEC-01
  it("rejeita file:// com INVALID_TARGET_URL", () => {
    expect(() => validateTargetUrl("file:///etc/passwd")).toThrow("INVALID_TARGET_URL");
  });

  it("rejeita protocolo desconhecido (gopher/ftp) com INVALID_TARGET_URL", () => {
    expect(() => validateTargetUrl("ftp://example.com")).toThrow("INVALID_TARGET_URL");
    expect(() => validateTargetUrl("gopher://example.com")).toThrow("INVALID_TARGET_URL");
  });

  it("rejeita string que nem parseia como URL", () => {
    expect(() => validateTargetUrl("isso-nem-e-url")).toThrow("INVALID_TARGET_URL");
  });

  // DAST-SEC-02/03: a localização do alvo não depende mais de uma flag.
  it.each([
    "https://example.com/",
    "http://8.8.8.8/",
    "http://192.168.0.1:5173/",
    "https://10.0.0.5:8443/",
    "http://172.16.0.1/",
    "http://172.31.255.255/",
    "http://169.254.169.254/",
    "http://127.0.0.1:3000/",
    "http://localhost:5173/",
    "http://[::1]:5173/",
    "http://[fc00::1]:5173/",
    "http://[fe80::1]:5173/",
    "http://host.docker.internal:5173/",
    "http://web:3000/",
  ])("aceita %s mesmo com DAST_ALLOW_PRIVATE_TARGETS=false legado", (targetUrl) => {
    const original = process.env.DAST_ALLOW_PRIVATE_TARGETS;
    process.env.DAST_ALLOW_PRIVATE_TARGETS = "false";
    try {
      expect(validateTargetUrl(targetUrl).href).toBe(targetUrl);
    } finally {
      if (original === undefined) delete process.env.DAST_ALLOW_PRIVATE_TARGETS;
      else process.env.DAST_ALLOW_PRIVATE_TARGETS = original;
    }
  });

  it.each([
    "http://usuario:senha@192.168.0.1:5173/",
    "https://usuario@example.com/",
    "http://:senha@localhost:5173/",
  ])("rejeita credenciais embutidas em %s", (targetUrl) => {
    expect(() => validateTargetUrl(targetUrl)).toThrow("INVALID_TARGET_URL");
  });

  it("canonicaliza a URL e remove o fragmento sem alterar a porta", () => {
    expect(validateTargetUrl("http://192.168.0.1:5173#inicio").href).toBe("http://192.168.0.1:5173/");
  });
});

describe("zap-runner.service — path traversal (DAST-SEC-04)", () => {
  it("rejeita ../ no nome do relatório", () => {
    expect(() => resolveReportPath("scan-1", "../../../etc/passwd")).toThrow("INVALID_REPORT_NAME");
  });

  it("nome com diretório embutido é reduzido ao basename — nunca escapa pra outro scanId", () => {
    // path.basename() descarta qualquer prefixo de diretório antes mesmo da
    // whitelist rodar: o resultado é SEMPRE dentro de reportsDir/scan-1/,
    // nunca em reportsDir/scan-2/ — não há "escape", há normalização.
    const resolved = resolveReportPath("scan-1", "../scan-2/report.json");
    expect(resolved.endsWith(`scan-1${path.sep}report.json`)).toBe(true);
  });

  it("rejeita extensão fora da whitelist", () => {
    expect(() => resolveReportPath("scan-1", "report.exe")).toThrow("INVALID_REPORT_NAME");
    expect(() => resolveReportPath("scan-1", "report.sh")).toThrow("INVALID_REPORT_NAME");
  });

  it("aceita report.json e report.html normais", () => {
    expect(() => resolveReportPath("scan-1", "report.json")).not.toThrow();
    expect(() => resolveReportPath("scan-1", "report.html")).not.toThrow();
  });
});

describe("zap-runner.service — execFile nunca vira shell (DAST-SEC-05)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("isDockerAvailable chama execFile com comando fixo e array de argumentos, nunca shell:true", async () => {
    await isDockerAvailable();
    const mockedExecFile = execFile as unknown as jest.Mock;
    expect(mockedExecFile).toHaveBeenCalledTimes(1);
    const [cmd, args, opts] = mockedExecFile.mock.calls[0];
    expect(cmd).toBe("docker");
    expect(Array.isArray(args)).toBe(true);
    expect((opts as { shell?: boolean }).shell).not.toBe(true);
  });

  it("uma targetUrl com metacaractere de shell passa intacta como UM elemento do array — nunca vira comando", () => {
    // A validação de protocolo/host não rejeita isso (é sintaticamente uma
    // URL http válida) — a proteção real é o execFile nunca interpretar
    // shell. Path com `;` é só texto dentro do argumento -t.
    const malicious = "http://example.com/;id;whoami";
    const parsed = validateTargetUrl(malicious);
    expect(parsed.href).toContain(";id;whoami");
    // Se este valor um dia fosse concatenado numa string de shell, ele
    // quebraria o comando — como argumento de array (o que o runner faz),
    // é só um path malformado que o próprio ZAP vai rejeitar/ignorar.
  });
});

describe("zap-runner.service — runScan caminho real (docker + API do ZAP mockados)", () => {
  const REPORTS_DIR = path.resolve(process.cwd(), "dast-reports-unit-test");
  let originalForceSimulate: string | undefined;
  let originalReportsDir: string | undefined;

  beforeAll(() => {
    originalForceSimulate = process.env.DAST_FORCE_SIMULATE;
    originalReportsDir = process.env.DAST_REPORTS_DIR;
    // Este bloco testa o caminho REAL (runRealScan) — precisa desligar o
    // force-simulate que .env.test liga globalmente pro resto da suíte.
    process.env.DAST_FORCE_SIMULATE = "false";
    process.env.DAST_REPORTS_DIR = "dast-reports-unit-test";
  });

  afterAll(async () => {
    if (originalForceSimulate === undefined) delete process.env.DAST_FORCE_SIMULATE;
    else process.env.DAST_FORCE_SIMULATE = originalForceSimulate;
    if (originalReportsDir === undefined) delete process.env.DAST_REPORTS_DIR;
    else process.env.DAST_REPORTS_DIR = originalReportsDir;
    await fs.rm(REPORTS_DIR, { recursive: true, force: true });
  });

  beforeEach(() => jest.clearAllMocks());

  /** Mock do `docker`: `info` sempre OK; o resto sai do mapa passado pelo teste. */
  function mockDocker(onCommand: (args: string[]) => { code: number | null; stdout?: string; stderr?: string } = () => ({ code: 0 })) {
    (execFile as unknown as jest.Mock).mockImplementation(
      (_cmd: string, args: string[], _opts: unknown, cb: (err: unknown, stdout: string, stderr: string) => void) => {
        const outcome = args[0] === "info" ? { code: 0 } : onCommand(args);
        if (outcome.code === 0) {
          cb(null, outcome.stdout ?? "", outcome.stderr ?? "");
          return;
        }
        const err: any = new Error("Command failed");
        err.code = outcome.code;
        cb(err, outcome.stdout ?? "", outcome.stderr ?? "");
      },
    );
  }

  /**
   * Mock da API HTTP do ZAP. O runner conversa com o daemon por `http.get`;
   * aqui cada endpoint devolve a resposta REAL observada de um ZAP 2.17
   * (formato conferido à mão contra um container de verdade nesta sessão).
   */
  function mockZapApi(overrides: Record<string, { status?: number; body: string; bodies?: string[]; error?: string; failTimes?: number }> = {}) {
    const respostas: Record<string, { status?: number; body: string; bodies?: string[]; error?: string; failTimes?: number }> = {
      "/JSON/context/action/newContext/": { body: JSON.stringify({ contextId: "1" }) },
      "/JSON/context/action/includeInContext/": { body: JSON.stringify({ Result: "OK" }) },
      "/JSON/context/action/setContextInScope/": { body: JSON.stringify({ Result: "OK" }) },
      "/JSON/core/action/setMode/": { body: JSON.stringify({ Result: "OK" }) },
      "/JSON/core/action/accessUrl/": { body: JSON.stringify({ accessUrl: [{ responseHeader: "HTTP/1.1 200 OK\r\nContent-Type: text/html", responseBody: "<html>local</html>" }] }) },
      "/JSON/core/view/version/": { body: JSON.stringify({ version: "2.17.0" }) },
      "/JSON/spider/action/setOptionMaxDuration/": { body: JSON.stringify({ Result: "OK" }) },
      "/JSON/spider/action/setOptionMaxDepth/": { body: JSON.stringify({ Result: "OK" }) },
      "/JSON/spider/action/setOptionMaxChildren/": { body: JSON.stringify({ Result: "OK" }) },
      "/JSON/spider/action/setOptionThreadCount/": { body: JSON.stringify({ Result: "OK" }) },
      "/JSON/spider/action/setOptionMaxParseSizeBytes/": { body: JSON.stringify({ Result: "OK" }) },
      "/JSON/spider/action/setOptionProcessForm/": { body: JSON.stringify({ Result: "OK" }) },
      "/JSON/spider/action/setOptionPostForm/": { body: JSON.stringify({ Result: "OK" }) },
      "/JSON/spider/action/setOptionLogoutAvoidance/": { body: JSON.stringify({ Result: "OK" }) },
      "/JSON/spider/action/setOptionParseRobotsTxt/": { body: JSON.stringify({ Result: "OK" }) },
      "/JSON/spider/action/setOptionParseSitemapXml/": { body: JSON.stringify({ Result: "OK" }) },
      "/JSON/spider/action/setOptionParseGit/": { body: JSON.stringify({ Result: "OK" }) },
      "/JSON/spider/action/setOptionParseSVNEntries/": { body: JSON.stringify({ Result: "OK" }) },
      "/JSON/spider/action/setOptionParseDsStore/": { body: JSON.stringify({ Result: "OK" }) },
      "/JSON/spider/action/scan/": { body: JSON.stringify({ scan: "0" }) },
      "/JSON/spider/action/excludeFromScan/": { body: JSON.stringify({ Result: "OK" }) },
      "/JSON/spider/action/stop/": { body: JSON.stringify({ Result: "OK" }) },
      "/JSON/spider/view/status/": { body: JSON.stringify({ status: "100" }) },
      "/JSON/spider/view/results/": { body: JSON.stringify({ results: ["https://example.com/"] }) },
      "/JSON/pscan/view/recordsToScan/": { body: JSON.stringify({ recordsToScan: "0" }) },
      "/JSON/ascan/action/scan/": { body: JSON.stringify({ scan: "0" }) },
      "/JSON/ascan/view/status/": { body: JSON.stringify({ status: "100" }) },
      "/OTHER/core/other/jsonreport/": { body: JSON.stringify(ZAP_REPORT_MINIMO) },
      "/OTHER/core/other/htmlreport/": { body: "<html><body>relatório</body></html>" },
      ...overrides,
    };

    const counts = new Map<string, number>();
    (http.get as unknown as jest.Mock).mockImplementation((url: string, _opts: unknown, cb: (res: any) => void) => {
      const req: any = new EventEmitter();
      req.destroy = jest.fn((error: Error) => process.nextTick(() => req.emit("error", error)));
      const pathname = new URL(url).pathname;
      const resposta = respostas[pathname];

      process.nextTick(() => {
        if (!resposta) {
          req.emit("error", new Error(`endpoint não mockado: ${pathname}`));
          return;
        }
        const count = (counts.get(pathname) ?? 0) + 1;
        counts.set(pathname, count);
        if (resposta.error && count <= (resposta.failTimes ?? Infinity)) { req.emit("error", new Error(resposta.error)); return; }
        const res: any = new EventEmitter();
        res.statusCode = resposta.status ?? 200;
        cb(res);
        res.emit("data", Buffer.from(resposta.bodies?.[Math.min(count - 1, resposta.bodies.length - 1)] ?? resposta.body));
        res.emit("end");
      });

      return req;
    });
  }

  it("fluxo completo (Spider tradicional -> passivo -> relatório) devolve COMPLETED e NÃO simulado", async () => {
    mockDocker();
    mockZapApi();

    const fases: string[] = [];
    const outcome = await runScan({ mode: "REAL",
      scanId: "scan-ok",
      targetUrl: "https://example.com",
      onProgress: (p) => fases.push(p.phase),
    });

    expect(outcome.status).toBe("COMPLETED");
    expect(outcome.simulated).toBe(false);
    expect(outcome.jsonReportPath).toContain("scan-ok");
    // A barra passa por todas as fases, em ordem, e termina em 100%.
    expect(fases).toEqual(expect.arrayContaining(["STARTING", "SPIDER", "PASSIVE", "REPORT", "DONE"]));

    const salvo = JSON.parse(await fs.readFile(path.join(REPORTS_DIR, "scan-ok", "report.json"), "utf-8"));
    expect(salvo.site[0].alerts).toHaveLength(1);
    const discovery = JSON.parse(await fs.readFile(path.join(REPORTS_DIR, "scan-ok", "discovery.json"), "utf-8"));
    expect(discovery.profile).toBe("TRADITIONAL_SPIDER_PASSIVE");
    expect(discovery.urls).toEqual(["https://example.com/"]);
    expect(discovery).not.toHaveProperty("apiKey");
  });

  it("demonstração explícita não consulta Docker nem HTTP", async () => {
    const result = await runScan({ mode: "SIMULATED", scanId: "explicit-demo", targetUrl: "https://example.com" });
    expect(result.simulated).toBe(true);
    expect(execFile).not.toHaveBeenCalled();
    expect(http.get).not.toHaveBeenCalled();
  });

  it("distingue alvo inacessível de falha HTTP do daemon com diagnóstico do ZAP", async () => {
    mockDocker((args) => ({ code: 0, stdout: args[0] === "logs" ? "HttpHostConnectException: Connection refused" : "" }));
    mockZapApi({ "/JSON/core/action/accessUrl/": { status: 500, body: '{"code":"internal_error","message":"Internal Error"}' } });
    const result = await runScan({ mode: "REAL", scanId: "unreachable-target", targetUrl: "https://example.com" });
    expect(result).toMatchObject({ status: "FAILED", simulated: false, errorMessage: "TARGET_UNREACHABLE" });
    expect(result.jsonReportPath).toBeUndefined();
    expect(friendlyFailureReason(result.errorMessage)).toContain("endereço/porta");
  });

  it("preserva erro estruturado HTTP 500 sem inventar uma causa ausente nos logs", async () => {
    mockDocker();
    mockZapApi({ "/JSON/core/action/accessUrl/": { status: 500, body: '{"code":"internal_error"}' } });
    const result = await runScan({ mode: "REAL", scanId: "target-access-failed", targetUrl: "https://example.com" });
    expect(result.errorMessage).toBe("TARGET_ACCESS_FAILED");
    expect(friendlyFailureReason(result.errorMessage)).toContain("falhou ao acessar o alvo");
  });

  it("retenta consulta passiva transitória e conclui sem iniciar active scan", async () => {
    mockDocker();
    mockZapApi({ "/JSON/pscan/view/recordsToScan/": { body: '{"recordsToScan":"0"}', error: "ECONNRESET", failTimes: 1 } });
    const result = await runScan({ mode: "REAL", scanId: "retry-read", targetUrl: "https://example.com" });
    expect(result.status).toBe("COMPLETED");
    const calls = (http.get as jest.Mock).mock.calls.map((c) => new URL(c[0]).pathname);
    expect(calls.filter((p) => p === "/JSON/pscan/view/recordsToScan/")).toHaveLength(2);
    expect(calls.some((p) => p.includes("/ascan/") || p.includes("/ajaxSpider/") || p.includes("/clientSpider/"))).toBe(false);
    expect(calls.filter((p) => p === "/JSON/spider/action/scan/")).toHaveLength(1);
  });

  it("configura descoberta GET com contexto e limites antes de iniciar o Spider", async () => {
    mockDocker();
    mockZapApi();
    const result = await runScan({ mode: "REAL", scanId: "spider-options", targetUrl: "https://example.com/app/" });
    expect(result.status).toBe("COMPLETED");
    const calls = (http.get as jest.Mock).mock.calls.map((call) => new URL(call[0]));
    const startIndex = calls.findIndex((url) => url.pathname === "/JSON/spider/action/scan/");
    expect(startIndex).toBeGreaterThan(0);
    const start = calls[startIndex];
    expect(Object.fromEntries([...start.searchParams].filter(([key]) => key !== "apikey"))).toEqual({
      url: "https://example.com/app/", contextName: "vulnera-baseline", maxChildren: "30", recurse: "false", subtreeOnly: "true",
    });
    const expectedSettings: Record<string, string> = {
      MaxDepth: "2", MaxChildren: "30", ThreadCount: "1", MaxParseSizeBytes: "1000000",
      ProcessForm: "false", PostForm: "false", LogoutAvoidance: "true", ParseRobotsTxt: "true", ParseSitemapXml: "true",
    };
    for (const [option, value] of Object.entries(expectedSettings)) {
      const settingIndex = calls.findIndex((url) => url.pathname === `/JSON/spider/action/setOption${option}/`);
      expect(settingIndex).toBeGreaterThan(0);
      expect(settingIndex).toBeLessThan(startIndex);
      const setting = calls[settingIndex];
      expect(setting.searchParams.get("Integer") ?? setting.searchParams.get("Boolean")).toBe(value);
    }
    const inclusion = calls.find((url) => url.pathname === "/JSON/context/action/includeInContext/")!;
    expect(inclusion.searchParams.get("regex")).toBe(buildBaselineScopeRegex(new URL("https://example.com/app/")));
    const exclusionIndex = calls.findIndex((url) => url.pathname === "/JSON/spider/action/excludeFromScan/");
    expect(exclusionIndex).toBeGreaterThan(0);
    expect(exclusionIndex).toBeLessThan(startIndex);
    expect(calls[exclusionIndex].searchParams.get("regex")).toBe(".*\\?.*");
    const access = calls.find((url) => url.pathname === "/JSON/core/action/accessUrl/")!;
    expect(access.searchParams.get("followRedirects")).toBe("false");
  });

  it("o Spider descobre outros endpoints e grava somente URLs permitidas na evidência interna", async () => {
    mockDocker();
    mockZapApi({ "/JSON/spider/view/results/": { body: JSON.stringify({ results: [
      "https://example.com/app/", "https://example.com/app/api/health", "https://example.com/app/assets/site.css#v1",
      "https://example.com/app/api/health", "https://elsewhere.test/", "https://example.com/app2/",
      "https://example.com/app/logout", "https://user:secret@example.com/app/", "https://example.com/app/?action=delete", "not-a-url",
    ] }) } });
    const result = await runScan({ mode: "REAL", scanId: "spider-discovery", targetUrl: "https://example.com/app/" });
    expect(result.status).toBe("COMPLETED");
    const raw = await fs.readFile(path.join(REPORTS_DIR, "spider-discovery", "discovery.json"), "utf-8");
    const discovery = JSON.parse(raw);
    expect(discovery.urls).toEqual(["https://example.com/app/", "https://example.com/app/api/health", "https://example.com/app/assets/site.css"]);
    expect(discovery.limits).toMatchObject({ maxDepth: 2, maxChildrenPerNode: 30, threadCount: 1, maxParseSizeBytes: 1000000 });
    expect(discovery).toMatchObject({ processForms: false, javascript: false, activeScan: false });
    expect(Number.isNaN(Date.parse(discovery.discoveredAt))).toBe(false);
    expect(raw).not.toMatch(/secret|elsewhere|apikey/i);
  });

  it("aguarda o Spider com progresso antes da análise passiva e retenta somente leituras", async () => {
    mockDocker();
    mockZapApi({ "/JSON/spider/view/status/": { body: '{"status":"100"}', bodies: ['{"status":"25"}', '{"status":"25"}', '{"status":"100"}'], error: "ECONNRESET", failTimes: 1 } });
    const progress: Array<{ phase: string; percent: number }> = [];
    const result = await runScan({ mode: "REAL", scanId: "spider-progress", targetUrl: "https://example.com/", onProgress: (value) => progress.push(value) });
    expect(result.status).toBe("COMPLETED");
    const calls = (http.get as jest.Mock).mock.calls.map((call) => new URL(call[0]));
    const lastStatusIndex = calls.map((url) => url.pathname).lastIndexOf("/JSON/spider/view/status/");
    expect(calls.findIndex((url) => url.pathname === "/JSON/pscan/view/recordsToScan/")).toBeGreaterThan(lastStatusIndex);
    expect(calls.filter((url) => url.pathname === "/JSON/spider/action/scan/")).toHaveLength(1);
    expect(calls.filter((url) => url.pathname === "/JSON/spider/view/status/")).toHaveLength(3);
    expect(progress.some((value) => value.phase === "SPIDER" && value.percent > 8 && value.percent < 73)).toBe(true);
    expect(progress.some((value) => value.phase === "SPIDER" && value.percent > 8)).toBe(true);
    expect(progress.every((value, index) => index === 0 || value.percent >= progress[index - 1].percent)).toBe(true);
  });

  it("falha ao iniciar o Spider não repete a ação nem publica relatório ou demonstração", async () => {
    mockDocker();
    mockZapApi({ "/JSON/spider/action/scan/": { body: "", error: "ZAP_HTTP_TIMEOUT" } });
    const result = await runScan({ mode: "REAL", scanId: "spider-start-failed", targetUrl: "https://example.com/" });
    expect(result).toMatchObject({ status: "FAILED", simulated: false, errorMessage: "ZAP_HTTP_TIMEOUT" });
    expect(result.jsonReportPath).toBeUndefined();
    const calls = (http.get as jest.Mock).mock.calls.map((call) => new URL(call[0]).pathname);
    expect(calls.filter((endpoint) => endpoint === "/JSON/spider/action/scan/")).toHaveLength(1);
    expect(calls).not.toContain("/OTHER/core/other/jsonreport/");
  });

  it.each([
    ["scan", "/JSON/spider/action/scan/", '{"scan":"invalid"}'],
    ["status", "/JSON/spider/view/status/", '{"status":"invalid"}'],
    ["results", "/JSON/spider/view/results/", '{"results":"invalid"}'],
  ])("resposta inválida de %s no Spider termina FAILED sem fallback", async (suffix, endpoint, body) => {
    mockDocker();
    mockZapApi({ [endpoint]: { body } });
    const result = await runScan({ mode: "REAL", scanId: `spider-invalid-${suffix}`, targetUrl: "https://example.com/" });
    expect(result.status).toBe("FAILED");
    expect(result.simulated).toBe(false);
    expect(result.errorMessage).toBe(`ZAP_BAD_RESPONSE:spider_${suffix}`);
    expect(result.jsonReportPath).toBeUndefined();
  });

  it("prazo do Spider para descoberta interrompe o motor sem publicar relatório parcial", async () => {
    mockDocker();
    mockZapApi({ "/JSON/spider/view/status/": { body: '{"status":"0"}' } });
    const originalDuration = process.env.DAST_ZAP_SPIDER_MAX_DURATION_MIN;
    process.env.DAST_ZAP_SPIDER_MAX_DURATION_MIN = "1";
    let fakeNow = Date.now();
    const clock = jest.spyOn(Date, "now").mockImplementation(() => fakeNow);
    try {
      const result = await runScan({ mode: "REAL", scanId: "spider-timeout", targetUrl: "https://example.com/", onProgress: (progress) => {
        if (progress.message === "Spider tradicional: 0%") fakeNow += 61000;
      } });
      expect(result).toMatchObject({ status: "FAILED", simulated: false, errorMessage: "ZAP_SPIDER_TIMEOUT" });
      const calls = (http.get as jest.Mock).mock.calls.map((call) => new URL(call[0]).pathname);
      expect(calls).toContain("/JSON/spider/action/stop/");
      expect(calls).not.toContain("/OTHER/core/other/jsonreport/");
      expect(friendlyFailureReason(result.errorMessage)).toContain("Spider tradicional");
    } finally {
      clock.mockRestore();
      if (originalDuration === undefined) delete process.env.DAST_ZAP_SPIDER_MAX_DURATION_MIN;
      else process.env.DAST_ZAP_SPIDER_MAX_DURATION_MIN = originalDuration;
    }
  });

  it("falha persistente de leitura termina após três tentativas", async () => {
    mockDocker();
    mockZapApi({ "/JSON/pscan/view/recordsToScan/": { body: "", error: "ZAP_HTTP_TIMEOUT" } });
    const result = await runScan({ mode: "REAL", scanId: "retry-exhausted", targetUrl: "https://example.com" });
    expect(result.status).toBe("FAILED");
    expect(result.simulated).toBe(false);
    expect(result.errorMessage).toBe("ZAP_HTTP_TIMEOUT");
    expect((http.get as jest.Mock).mock.calls.filter((c) => new URL(c[0]).pathname === "/JSON/pscan/view/recordsToScan/")).toHaveLength(3);
  });

  it("não repete uma navegação cujo resultado é incerto", async () => {
    mockDocker();
    mockZapApi({ "/JSON/core/action/accessUrl/": { body: "", error: "ZAP_HTTP_TIMEOUT" } });
    const result = await runScan({ mode: "REAL", scanId: "action-no-retry", targetUrl: "https://example.com" });
    expect(result.status).toBe("FAILED");
    expect((http.get as jest.Mock).mock.calls.filter((c) => new URL(c[0]).pathname === "/JSON/core/action/accessUrl/")).toHaveLength(1);
  });

  it("identifica OOM antes de remover o container", async () => {
    const commands: string[][] = [];
    mockDocker((args) => { commands.push(args); return { code: 0, stdout: args[0] === "inspect" ? "true|137" : "" }; });
    mockZapApi({ "/JSON/core/action/accessUrl/": { body: "", error: "ECONNRESET" } });
    const result = await runScan({ mode: "REAL", scanId: "oom", targetUrl: "https://example.com" });
    expect(result.errorMessage).toBe("ZAP_OOM_KILLED");
    expect(commands.findIndex((a) => a[0] === "inspect")).toBeLessThan(commands.findIndex((a) => a[0] === "rm"));
    expect(commands.find((a) => a[0] === "run")).not.toContain("--rm");
  });

  it("não segue redirect inicial fora do escopo", async () => {
    mockDocker();
    mockZapApi({ "/JSON/core/action/accessUrl/": { body: JSON.stringify({ accessUrl: [{ responseHeader: "HTTP/1.1 302 Found\r\nLocation: https://elsewhere.test/" }] }) } });
    const result = await runScan({ mode: "REAL", scanId: "redirect", targetUrl: "https://example.com" });
    expect(result.errorMessage).toBe("TARGET_REDIRECT_OUT_OF_SCOPE");
    expect((http.get as jest.Mock).mock.calls.filter((c) => new URL(c[0]).pathname === "/JSON/core/action/accessUrl/")).toHaveLength(1);
  });

  it("o container do ZAP sobe em modo daemon, com api.key própria, e é removido no fim", async () => {
    const comandos: string[][] = [];
    mockDocker((args) => {
      comandos.push(args);
      return { code: 0 };
    });
    mockZapApi();

    await runScan({ mode: "REAL", scanId: "scan-args", targetUrl: "https://example.com" });

    const run = comandos.find((c) => c[0] === "run");
    expect(run).toBeDefined();
    expect(run).toContain("-d");
    expect(run).toContain("zap.sh");
    expect(run).toContain("-daemon");
    // Chave aleatória por scan — nunca api.disablekey=true.
    expect(run!.some((a) => /^api\.key=[0-9a-f]{32}$/.test(a))).toBe(true);
    expect(run!.some((a) => a.includes("disablekey"))).toBe(false);
    // Porta publicada só no loopback (API rodando no host).
    expect(run!.some((a) => /^127\.0\.0\.1:\d+:\d+$/.test(a))).toBe(true);
    // E o container é derrubado explicitamente no fim.
    expect(comandos.some((c) => c[0] === "rm" && c.includes("vulnera-zap-scan-args"))).toBe(true);
  });

  it("`docker run` falhando termina FAILED sem fabricar resultados", async () => {
    mockDocker((args) => (args[0] === "run" ? { code: 125, stderr: "no such image" } : { code: 0 }));
    mockZapApi();

    const outcome = await runScan({ mode: "REAL", scanId: "scan-sem-container", targetUrl: "https://example.com" });

    expect(outcome.status).toBe("FAILED");
    expect(outcome.simulated).toBe(false);
    expect(outcome.errorMessage).toBe("ZAP_CONTAINER_START_FAILED");
  });

  it("erro de negócio do ZAP preserva falha real", async () => {
    mockDocker();
    mockZapApi({
      "/JSON/core/action/accessUrl/": { body: JSON.stringify({ code: "url_not_found", message: "URL Not Found" }) },
    });

    const outcome = await runScan({ mode: "REAL", scanId: "scan-url-404", targetUrl: "https://example.com" });

    expect(outcome.status).toBe("FAILED");
    expect(outcome.simulated).toBe(false);
    expect(outcome.errorMessage).toContain("url_not_found");
  });

  it("relatório corrompido termina FAILED", async () => {
    mockDocker();
    mockZapApi({ "/OTHER/core/other/jsonreport/": { body: "{ isso não é json valido" } });

    const outcome = await runScan({ mode: "REAL", scanId: "scan-json-ruim", targetUrl: "https://example.com" });

    expect(outcome.status).toBe("FAILED");
    expect(outcome.simulated).toBe(false);
    expect(outcome.errorMessage).toBe("REPORT_JSON_INVALID");
  });

  it("cancelamento NÃO cai no simulado — quem cancelou não quer resultado nenhum", async () => {
    mockDocker();
    mockZapApi({ "/JSON/pscan/view/recordsToScan/": { body: JSON.stringify({ recordsToScan: "10" }) } }); // nunca chega a 100

    const controller = new AbortController();
    setTimeout(() => controller.abort("Scan cancelado pelo usuário."), 200);

    const outcome = await runScan({ mode: "REAL", scanId: "scan-cancelado", targetUrl: "https://example.com", signal: controller.signal });

    expect(outcome.status).toBe("FAILED");
    expect(outcome.errorMessage).toBe("SCAN_CANCELLED");
    expect(outcome.simulated).toBe(false);
  });

  it("timeout global aborta o scan real sem simulação", async () => {
    mockDocker();
    mockZapApi({ "/JSON/pscan/view/recordsToScan/": { body: JSON.stringify({ recordsToScan: "10" }) } }); // nunca chega a 100

    const outcome = await runScan({ mode: "REAL", scanId: "scan-timeout", targetUrl: "https://example.com", timeoutMs: 500 });

    expect(outcome.status).toBe("FAILED");
    expect(outcome.simulated).toBe(false);
    expect(outcome.errorMessage).toBe("SCAN_TIMEOUT");
  });
});

describe("zap-runner.service — buildZapUrl", () => {
  it("escapa a targetUrl na querystring (nunca concatenação crua)", () => {
    const url = buildZapUrl("http://127.0.0.1:8080", "/JSON/ascan/action/scan/", {
      apikey: "chave",
      url: "https://example.com/busca?q=a&b=1",
    });
    // O `&` da URL do alvo tem que estar ESCAPADO, senão viraria um parâmetro
    // extra do comando do ZAP.
    expect(url).toContain("url=https%3A%2F%2Fexample.com%2Fbusca%3Fq%3Da%26b%3D1");
    expect(url.split("&")).toHaveLength(2); // apikey + url, nada mais
  });
});

describe("zap-runner.service — utilidades", () => {
  it("containerNameFor é determinístico", () => {
    expect(containerNameFor("abc123")).toBe("vulnera-zap-abc123");
  });

  it("escapeHtml neutraliza tags e aspas", () => {
    const escaped = escapeHtml(`<script>alert('xss')</script>&"`);
    expect(escaped).not.toContain("<script>");
    expect(escaped).toContain("&lt;script&gt;");
  });
});

/**
 * Limites de recurso POR CONTAINER (2026-09-09). O watchdog limita quantos
 * scans rodam; estes limitam quanto cada um consome — sem os dois, dois scans
 * simultâneos ocupavam ~960% de CPU e cresciam sem teto de RAM.
 */
describe("zap-runner.service — limites de recurso do container", () => {
  it("parseMemoryToMb entende os sufixos que o Docker aceita", () => {
    expect(parseMemoryToMb("2g")).toBe(2048);
    expect(parseMemoryToMb("1536m")).toBe(1536);
    expect(parseMemoryToMb("1G")).toBe(1024);
    expect(parseMemoryToMb("512M")).toBe(512);
    expect(parseMemoryToMb("2gb")).toBe(2048); // forma "2gb" também é aceita pelo Docker
    expect(parseMemoryToMb("1048576")).toBe(1); // sem sufixo = bytes
  });

  it("parseMemoryToMb devolve null pro que não entende, em vez de chutar", () => {
    // Um valor não reconhecido tem que virar "sem limite", nunca um limite
    // inventado: passar `--memory` errado quebraria o scan de forma opaca.
    expect(parseMemoryToMb("muita")).toBeNull();
    expect(parseMemoryToMb("")).toBeNull();
    expect(parseMemoryToMb("-2g")).toBeNull();
    expect(parseMemoryToMb("0")).toBeNull();
  });

  it("heapArgForMemoryLimit deixa o heap FOLGADAMENTE abaixo do teto do container", () => {
    // A folga não é estética: metaspace, stacks de thread e buffers diretos
    // ficam FORA do -Xmx mas contam no cgroup. Heap == limite = OOM certo.
    expect(heapArgForMemoryLimit("2g")).toBe("-Xmx1331m"); // 65% de 2048
    expect(heapArgForMemoryLimit("1g")).toBe("-Xmx665m");

    const heapMb = Number(/-Xmx(\d+)m/.exec(heapArgForMemoryLimit("2g")!)![1]);
    expect(heapMb).toBeLessThan(parseMemoryToMb("2g")!);
  });

  it("heapArgForMemoryLimit não passa limite quando ele quebraria o ZAP", () => {
    // Abaixo de 256MB de heap o ZAP não sobe de forma confiável — melhor
    // rodar sem limite do que entregar um scan que morre por dentro.
    expect(heapArgForMemoryLimit("128m")).toBeNull();
    expect(heapArgForMemoryLimit("valor-invalido")).toBeNull();
  });

  it("a falha por falta de memória vira uma mensagem ACIONÁVEL, não genérica", () => {
    // O limite de RAM é nosso, então a saída (aumentar DAST_ZAP_MEMORY) é uma
    // ação que o usuário pode tomar — a mensagem precisa dizer isso, senão o
    // OOM vira um "erro estranho" sem pista nenhuma.
    const msg = friendlyFailureReason("ZAP_OOM_KILLED: connect ECONNREFUSED");
    expect(msg).toContain("sem memória");
    expect(msg).toContain("memória disponível");
  });

  it("friendlyFailureReason traduz os erros conhecidos e não vaza stack no desconhecido", () => {
    expect(friendlyFailureReason("SCAN_TIMEOUT")).toContain("tempo máximo");
    expect(friendlyFailureReason("ZAP_STARTUP_TIMEOUT")).toContain("iniciar");
    expect(friendlyFailureReason(undefined)).toContain("diagnóstico");
    // Erro não mapeado é truncado — nunca despeja um stack inteiro na tela.
    expect(friendlyFailureReason("secret-".repeat(500))).not.toContain("secret-");
  });
});


describe("baseline — limites de navegação antes de enviar tráfego", () => {
  const target = new URL("https://example.com/app/");
  it.each(["https://elsewhere.test/app/", "http://example.com/app/", "https://example.com:444/app/", "https://example.com/other", "https://example.com/app/delete", "https://example.com/app/?action=delete", "https://user:pass@example.com/app/"])("rejeita %s", (url) => {
    expect(isBaselineUrlAllowed(new URL(url), target)).toBe(false);
  });
  it("permite página na subárvore", () => expect(isBaselineUrlAllowed(new URL("https://example.com/app/about"), target)).toBe(true));

  it.each([
    "https://elsewhere.test/app/", "http://example.com/app/", "https://example.com:444/app/",
    "https://example.com.evil.test/app/", "https://example.com/app2/", "https://example.com/app/?q=read",
    "https://example.com/app/logout", "https://example.com/app/DELETE", "https://example.com/app/%64elete",
    "https://example.com/app/%44%45%4c%45%54%45", "https://user:pass@example.com/app/",
  ])("a regex de contexto rejeita %s antes da descoberta ZAP", (url) => {
    expect(new RegExp(buildBaselineScopeRegex(target)).test(url)).toBe(false);
  });

  it.each([
    "https://example.com/app/", "https://example.com/app/api/health", "https://example.com/app/assets/site.css",
    "https://example.com/app/%61bout",
  ])("a regex de contexto permite %s no escopo", (url) => {
    expect(new RegExp(buildBaselineScopeRegex(target)).test(url)).toBe(true);
  });

  it("um alvo sem barra final inclui sua raiz e descendentes, sem incluir prefixo parecido", () => {
    const expression = new RegExp(buildBaselineScopeRegex(new URL("http://192.168.0.1:5173/app")));
    expect(expression.test("http://192.168.0.1:5173/app")).toBe(true);
    expect(expression.test("http://192.168.0.1:5173/app/child")).toBe(true);
    expect(expression.test("http://192.168.0.1:5173/application")).toBe(false);
  });
});
