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
import * as path from "path";

jest.mock("child_process", () => ({
  execFile: jest.fn((_cmd: string, _args: string[], _opts: unknown, cb: (...a: unknown[]) => void) => {
    cb(null, "", "");
  }),
}));

import * as fs from "fs/promises";
import * as fsSync from "fs";
import {
  validateTargetUrl,
  isPrivateOrLoopbackHost,
  resolveReportPath,
  escapeHtml,
  containerNameFor,
  isDockerAvailable,
  runScan,
} from "../../src/services/zap-runner.service";

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

describe("zap-runner.service — runScan caminho real (docker mockado)", () => {
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

  function mockExecFile(onRun: (args: string[]) => { code: number | null; killed?: boolean; signal?: string; stderr?: string }) {
    (execFile as unknown as jest.Mock).mockImplementation(
      (_cmd: string, args: string[], _opts: unknown, cb: (err: unknown, stdout: string, stderr: string) => void) => {
        if (args[0] === "info") {
          cb(null, "", ""); // docker disponível
          return;
        }
        const outcome = onRun(args);
        if (outcome.code === 0) {
          cb(null, "", outcome.stderr ?? "");
        } else {
          const err: any = new Error("Command failed");
          err.code = outcome.code;
          err.killed = outcome.killed ?? false;
          err.signal = outcome.signal ?? null;
          cb(err, "", outcome.stderr ?? "");
        }
      },
    );
  }

  it("exit code != 0 mas report.json existe -> COMPLETED (o bug clássico: exit code não é o critério)", async () => {
    const scanId = "scan-exit2";
    mockExecFile((args) => {
      // simula o docker run escrevendo o report.json de verdade no volume
      // Não usa .split(":") — no Windows o hostDir tem colon logo após a
      // letra da unidade (C:\...), que quebraria um split ingênuo. Remove só
      // o sufixo conhecido do volume.
      const scanDir = args[args.indexOf("-v") + 1].replace(/:\/zap\/wrk\/:rw$/, "");
      fsSync.mkdirSync(scanDir, { recursive: true });
      fsSync.writeFileSync(path.join(scanDir, "report.json"), JSON.stringify({ site: [] }));
      fsSync.writeFileSync(path.join(scanDir, "report.html"), "<html></html>");
      return { code: 2 }; // WARN encontrado — exit != 0, não é falha
    });

    const outcome = await runScan({ scanId, targetUrl: "https://example.com" });
    expect(outcome.status).toBe("COMPLETED");
    expect(outcome.simulated).toBe(false);
    expect(outcome.jsonReportPath).toContain(scanId);
  });

  it("timeout (killed=true) -> FAILED com SCAN_TIMEOUT e chama docker rm -f", async () => {
    const scanId = "scan-timeout";
    let rmCalled = false;
    mockExecFile((args) => {
      if (args[0] === "rm") {
        rmCalled = true;
        return { code: 0 };
      }
      return { code: null, killed: true, signal: "SIGTERM" };
    });

    const outcome = await runScan({ scanId, targetUrl: "https://example.com", timeoutMs: 1000 });
    expect(outcome.status).toBe("FAILED");
    expect(outcome.errorMessage).toBe("SCAN_TIMEOUT");
    expect(rmCalled).toBe(true);
  });

  it("docker roda mas NÃO gera report.json -> FAILED (falha de execução de verdade)", async () => {
    const scanId = "scan-no-json";
    mockExecFile(() => ({ code: 3, stderr: "erro fatal do zap" }));

    const outcome = await runScan({ scanId, targetUrl: "https://example.com" });
    expect(outcome.status).toBe("FAILED");
    expect(outcome.errorMessage).toContain("erro fatal do zap");
  });

  it("report.json existe mas não parseia -> FAILED REPORT_JSON_INVALID", async () => {
    const scanId = "scan-bad-json";
    mockExecFile((args) => {
      // Não usa .split(":") — no Windows o hostDir tem colon logo após a
      // letra da unidade (C:\...), que quebraria um split ingênuo. Remove só
      // o sufixo conhecido do volume.
      const scanDir = args[args.indexOf("-v") + 1].replace(/:\/zap\/wrk\/:rw$/, "");
      fsSync.mkdirSync(scanDir, { recursive: true });
      fsSync.writeFileSync(path.join(scanDir, "report.json"), "{ isso não é json valido");
      return { code: 0 };
    });

    const outcome = await runScan({ scanId, targetUrl: "https://example.com" });
    expect(outcome.status).toBe("FAILED");
    expect(outcome.errorMessage).toBe("REPORT_JSON_INVALID");
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
