/**
 * Valida o runner real contra um alvo descartável, sem tocar sites externos.
 * Registra métodos/URLs para provar limites e produz evidência para o TCC.
 * Consumidor: mantenedor, após npm run build, dentro da rede Docker da API.
 */
const { execFileSync } = require("node:child_process");
const fs = require("node:fs/promises");
const path = require("node:path");
const assert = require("node:assert/strict");
const { runScan } = require("../dist/services/zap-runner.service");

const suffix = Date.now().toString(36);
const target = `vulnera-dast-fixture-${suffix}`;
const network = process.env.DAST_ZAP_NETWORK || "vulnera-net";
const docker = (...args) => execFileSync("docker", args, { encoding: "utf8", timeout: 30000 });
const server = `
require('http').createServer((req,res)=>{
 console.log(JSON.stringify({method:req.method,url:req.url}));
 if(req.url==='/redirect') {res.writeHead(302,{Location:'http://outside.invalid/'});return res.end();}
 res.writeHead(200,{'Content-Type':'text/html','Set-Cookie':'demo=1'});
 res.end('<html><head><title>DAST fixture</title></head><body><a href="/about">About</a><a href="/redirect">Redirect</a><a href="http://outside.invalid/">External</a><a href="/delete">Delete</a><a href="/?action=delete">Query</a><form action="/submit" method="POST"><input name="name"></form></body></html>');
}).listen(8080,'0.0.0.0');`;

(async () => {
  const evidence = {};
  try {
    docker("run", "-d", "--name", target, "--network", network, "--memory", "128m", "--entrypoint", "node", "vulnera-tcc-api", "-e", server);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const started = Date.now();
    const result = await runScan({ scanId: `smoke-real-${suffix}`, mode: "REAL", targetUrl: `http://${target}:8080/`, onProgress: (p) => console.log(p.phase, p.percent, p.message) });
    assert.equal(result.status, "COMPLETED", JSON.stringify(result));
    assert.equal(result.simulated, false);
    const report = JSON.parse(await fs.readFile(result.jsonReportPath, "utf8"));
    const requests = docker("logs", target).trim().split("\n").map((line) => JSON.parse(line));
    assert(requests.length >= 3);
    assert(requests.every((r) => r.method === "GET" && ["/", "/about", "/redirect"].includes(r.url)), JSON.stringify(requests));
    assert(report.site?.some((site) => site.alerts?.length > 0), "Esperados alertas passivos reais do alvo controlado");
    evidence.real = { durationMs: Date.now() - started, version: report["@version"], result, requests };

    const demo = await runScan({ scanId: `smoke-demo-${suffix}`, mode: "SIMULATED", targetUrl: `http://${target}:8080/` });
    assert.equal(demo.simulated, true);
    assert.equal(docker("logs", target).trim().split("\n").length, requests.length, "Demo não deve acessar o alvo");
    evidence.demo = { status: demo.status, simulated: demo.simulated, extraTargetRequests: 0 };
    const unreachable = await runScan({ scanId: `smoke-unreachable-${suffix}`, mode: "REAL", targetUrl: `http://${target}:9/`, onProgress: (p) => console.log("unreachable", p.phase, p.percent) });
    assert.equal(unreachable.status, "FAILED");
    assert.equal(unreachable.simulated, false);
    assert.equal(unreachable.errorMessage, "TARGET_UNREACHABLE");
    assert.equal(unreachable.jsonReportPath, undefined);
    evidence.unreachable = unreachable;
    console.log("SMOKE_OK", JSON.stringify(evidence));
    const reportsDir = process.env.DAST_REPORTS_DIR || "/tmp/dast-smoke";
    await fs.mkdir(reportsDir, { recursive: true });
    await fs.writeFile(path.join(reportsDir, "smoke-evidence.json"), JSON.stringify(evidence, null, 2));
  } finally {
    try { docker("rm", "-f", target); } catch { /* Já encerrado pelo Docker. */ }
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
