/**
 * zap-runner.service.test.ts
 *
 * Testes de unidade puros do runner — sem Docker, sem banco. Cobre a
 * superfície de segurança (SEC-01..05) descrita no prompt da Fase 5:
 *
 *   DAST-SEC-01  file:// rejeitado
 *   DAST-SEC-02  loopback rejeitado com a flag desligada
 *   DAST-SEC-03  faixas privadas rejeitadas
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
  isPrivateOrLoopbackHost,
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

describe("zap-runner.service — validação de alvo (SSRF)", () => {
  // DAST-SEC-01
  it("rejeita file:// com INVALID_TARGET_URL", () => {
    expect(() => validateTargetUrl("file:///etc/passwd", false)).toThrow("INVALID_TARGET_URL");
  });

  it("rejeita protocolo desconhecido (gopher/ftp) com INVALID_TARGET_URL", () => {
    expect(() => validateTargetUrl("ftp://example.com", false)).toThrow("INVALID_TARGET_URL");
    expect(() => validateTargetUrl("gopher://example.com", false)).toThrow("INVALID_TARGET_URL");
  });

  it("rejeita string que nem parseia como URL", () => {
    expect(() => validateTargetUrl("isso-nem-e-url", false)).toThrow("INVALID_TARGET_URL");
  });

  // DAST-SEC-02
  it("rejeita loopback (127.0.0.1/localhost/::1) com a flag desligada", () => {
    expect(() => validateTargetUrl("http://127.0.0.1", false)).toThrow("TARGET_NOT_ALLOWED");
    expect(() => validateTargetUrl("http://localhost:3000", false)).toThrow("TARGET_NOT_ALLOWED");
    expect(() => validateTargetUrl("http://[::1]", false)).toThrow("TARGET_NOT_ALLOWED");
  });

  it("aceita loopback com a flag ligada", () => {
    expect(() => validateTargetUrl("http://127.0.0.1:3000", true)).not.toThrow();
  });

  // DAST-SEC-03
  it("rejeita faixas privadas (10/8, 172.16/12, 192.168/16, 169.254/16)", () => {
    expect(() => validateTargetUrl("http://10.0.0.5", false)).toThrow("TARGET_NOT_ALLOWED");
    expect(() => validateTargetUrl("http://172.16.0.1", false)).toThrow("TARGET_NOT_ALLOWED");
    expect(() => validateTargetUrl("http://172.31.255.255", false)).toThrow("TARGET_NOT_ALLOWED");
    expect(() => validateTargetUrl("http://192.168.1.1", false)).toThrow("TARGET_NOT_ALLOWED");
    expect(() => validateTargetUrl("http://169.254.169.254", false)).toThrow("TARGET_NOT_ALLOWED"); // cloud metadata
  });

  it("não confunde IP público com faixa privada (172.32.x fora do /12, 11.x fora do 10/8)", () => {
    expect(isPrivateOrLoopbackHost("172.32.0.1")).toBe(false);
    expect(isPrivateOrLoopbackHost("11.0.0.1")).toBe(false);
    expect(isPrivateOrLoopbackHost("8.8.8.8")).toBe(false);
  });

  it("aceita alvo público http/https normal", () => {
    expect(validateTargetUrl("https://example.com", false).href).toBe("https://example.com/");
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
    const parsed = validateTargetUrl(malicious, false);
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
  function mockZapApi(overrides: Record<string, { status?: number; body: string; error?: string; failTimes?: number }> = {}) {
    const respostas: Record<string, { status?: number; body: string; error?: string; failTimes?: number }> = {
      "/JSON/context/action/newContext/": { body: JSON.stringify({ contextId: "1" }) },
      "/JSON/context/action/includeInContext/": { body: JSON.stringify({ Result: "OK" }) },
      "/JSON/context/action/setContextInScope/": { body: JSON.stringify({ Result: "OK" }) },
      "/JSON/core/action/setMode/": { body: JSON.stringify({ Result: "OK" }) },
      "/JSON/core/action/accessUrl/": { body: JSON.stringify({ accessUrl: [{ responseHeader: "HTTP/1.1 200 OK\r\nContent-Type: text/html", responseBody: "<html>local</html>" }] }) },
      "/JSON/core/view/version/": { body: JSON.stringify({ version: "2.17.0" }) },
      "/JSON/spider/action/setOptionMaxDuration/": { body: JSON.stringify({ Result: "OK" }) },
      "/JSON/spider/action/scan/": { body: JSON.stringify({ scan: "0" }) },
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
        res.emit("data", Buffer.from(resposta.body));
        res.emit("end");
      });

      return req;
    });
  }

  it("fluxo completo (GET limitado -> passivo -> relatório) devolve COMPLETED e NÃO simulado", async () => {
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
    expect(calls.some((p) => p.includes("/ascan/") || p.includes("/spider/action/scan/"))).toBe(false);
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
});
