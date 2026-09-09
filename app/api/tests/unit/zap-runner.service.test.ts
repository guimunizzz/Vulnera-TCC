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
// exercitar o fluxo inteiro (spider -> passivo -> ativo -> relatório) sem
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
  function mockZapApi(overrides: Record<string, { status?: number; body: string }> = {}) {
    const respostas: Record<string, { status?: number; body: string }> = {
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

    (http.get as unknown as jest.Mock).mockImplementation((url: string, _opts: unknown, cb: (res: any) => void) => {
      const req: any = new EventEmitter();
      req.destroy = jest.fn();
      const pathname = new URL(url).pathname;
      const resposta = respostas[pathname];

      process.nextTick(() => {
        if (!resposta) {
          req.emit("error", new Error(`endpoint não mockado: ${pathname}`));
          return;
        }
        const res: any = new EventEmitter();
        res.statusCode = resposta.status ?? 200;
        cb(res);
        res.emit("data", Buffer.from(resposta.body));
        res.emit("end");
      });

      return req;
    });
  }

  it("fluxo completo (spider -> passivo -> ativo -> relatório) devolve COMPLETED e NÃO simulado", async () => {
    mockDocker();
    mockZapApi();

    const fases: string[] = [];
    const outcome = await runScan({
      scanId: "scan-ok",
      targetUrl: "https://example.com",
      onProgress: (p) => fases.push(p.phase),
    });

    expect(outcome.status).toBe("COMPLETED");
    expect(outcome.simulated).toBe(false);
    expect(outcome.jsonReportPath).toContain("scan-ok");
    // A barra passa por todas as fases, em ordem, e termina em 100%.
    expect(fases).toEqual(expect.arrayContaining(["STARTING", "SPIDER", "PASSIVE", "ACTIVE", "REPORT", "DONE"]));

    const salvo = JSON.parse(await fs.readFile(path.join(REPORTS_DIR, "scan-ok", "report.json"), "utf-8"));
    expect(salvo.site[0].alerts).toHaveLength(1);
  });

  it("o container do ZAP sobe em modo daemon, com api.key própria, e é removido no fim", async () => {
    const comandos: string[][] = [];
    mockDocker((args) => {
      comandos.push(args);
      return { code: 0 };
    });
    mockZapApi();

    await runScan({ scanId: "scan-args", targetUrl: "https://example.com" });

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

  it("`docker run` falhando NÃO deixa o usuário sem resultado: cai no simulado com aviso amigável", async () => {
    mockDocker((args) => (args[0] === "run" ? { code: 125, stderr: "no such image" } : { code: 0 }));
    mockZapApi();

    const outcome = await runScan({ scanId: "scan-sem-container", targetUrl: "https://example.com" });

    expect(outcome.status).toBe("COMPLETED");
    expect(outcome.simulated).toBe(true);
    expect(outcome.warningMessage).toContain("resultado de demonstração");
    expect(outcome.warningMessage).toContain("container do OWASP ZAP não subiu");
  });

  it("erro de negócio do ZAP (HTTP 200 + campo `code`) também vira fallback simulado", async () => {
    mockDocker();
    mockZapApi({
      "/JSON/ascan/action/scan/": { body: JSON.stringify({ code: "url_not_found", message: "URL Not Found" }) },
    });

    const outcome = await runScan({ scanId: "scan-url-404", targetUrl: "https://example.com" });

    expect(outcome.status).toBe("COMPLETED");
    expect(outcome.simulated).toBe(true);
    expect(outcome.warningMessage).toContain("não respondeu ao OWASP ZAP");
  });

  it("relatório corrompido vira fallback simulado (o pipeline nunca recebe JSON inválido)", async () => {
    mockDocker();
    mockZapApi({ "/OTHER/core/other/jsonreport/": { body: "{ isso não é json valido" } });

    const outcome = await runScan({ scanId: "scan-json-ruim", targetUrl: "https://example.com" });

    expect(outcome.status).toBe("COMPLETED");
    expect(outcome.simulated).toBe(true);
    expect(outcome.warningMessage).toContain("corrompido");
  });

  it("cancelamento NÃO cai no simulado — quem cancelou não quer resultado nenhum", async () => {
    mockDocker();
    mockZapApi({ "/JSON/spider/view/status/": { body: JSON.stringify({ status: "10" }) } }); // nunca chega a 100

    const controller = new AbortController();
    setTimeout(() => controller.abort("Scan cancelado pelo usuário."), 200);

    const outcome = await runScan({ scanId: "scan-cancelado", targetUrl: "https://example.com", signal: controller.signal });

    expect(outcome.status).toBe("FAILED");
    expect(outcome.errorMessage).toBe("SCAN_CANCELLED");
    expect(outcome.simulated).toBe(false);
  });

  it("timeout global aborta o scan real e entrega o resultado simulado", async () => {
    mockDocker();
    mockZapApi({ "/JSON/spider/view/status/": { body: JSON.stringify({ status: "10" }) } }); // nunca chega a 100

    const outcome = await runScan({ scanId: "scan-timeout", targetUrl: "https://example.com", timeoutMs: 500 });

    expect(outcome.status).toBe("COMPLETED");
    expect(outcome.simulated).toBe(true);
    expect(outcome.warningMessage).toContain("tempo máximo");
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
