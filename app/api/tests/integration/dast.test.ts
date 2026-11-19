/**
 * dast.test.ts
 *
 * Integração do módulo DAST via HTTP (supertest) + banco de teste real.
 * `DAST_FORCE_SIMULATE=true` no .env.test garante que NENHUM teste aqui
 * executa Docker ou tráfego ao alvo: demonstrações são explícitas e scans
 * reais terminam FAILED, sem fabricar achados ou trocar o modo solicitado.
 *
 *   DAST-RBAC-01..08  CLIENT recebe 403 em cada uma das 8 rotas
 *   DAST-RBAC-08      PENTESTER não acessa scan de outro PENTESTER
 *   DAST-RBAC-09      ADMIN acessa todos
 *   DAST-LIFE-01      scan concorrente no mesmo alvo -> 409
 *   DAST-LIFE-02      cancelamento muda status
 *   DAST-LIFE-03      timeout marca FAILED
 *   DAST-LIFE-04      watchdog marca órfãos no boot
 *   DAST-PIPE-03      reprocessar o mesmo scan não duplica
 *   DAST-PIPE-04      contadores batem com SELECT/groupBy
 *   DAST-PROG-01      progresso/fase chegam a 100/terminal no DTO
 *   DAST-SIM-01       resultado simulado é carimbado e explicado no DTO
 *   DAST-STAT-01      GET /status expõe limite de concorrência e estado do Docker
 *   DAST-TEN-01..06   ADR-056: tenant derivado da Application, nunca do body
 *   DAST-FILA-01..06  ADR-056: execução pela fila (guarda, duplicata, cancelamento, boot)
 */

import request from "supertest";
import * as path from "path";
import * as fs from "fs/promises";
import { app } from "../../src/app";
import { cleanDatabase } from "../setup";
import { prisma } from "../../src/database/prisma.database";
import { seedUser } from "../fixtures/users.fixture";
import { loginAs } from "../fixtures/auth.fixture";
import { DastScanRepository } from "../../src/repositories/dast-scan.repository";
import { extractFindingsFromReport } from "../../src/services/dast-findings.service";
import { makeDastScanService } from "../../src/factories/dast-scan.factory";
import { resolveReportPath } from "../../src/services/zap-runner.service";
import { seedPlan } from "../fixtures/plans.fixture";
import { seedCompany } from "../fixtures/companies.fixture";
import { seedApplication } from "../fixtures/applications.fixture";
import { seedProject, seedProjectMember } from "../fixtures/projects.fixture";

const PASSWORD = "senha12345";
const FIXTURE_PATH = path.resolve(__dirname, "../fixtures/dast/zap-report-example-com.json");

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Faz polling em GET /dast/scans/:id até chegar num estado terminal (ou estourar o próprio timeout do teste). */
async function waitForTerminalStatus(token: string, scanId: string, maxMs = 8000): Promise<any> {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    const res = await request(app).get(`/api/dast/scans/${scanId}`).set("Authorization", `Bearer ${token}`);
    if (["COMPLETED", "FAILED", "CANCELLED"].includes(res.body.status)) return res.body;
    await sleep(150);
  }
  throw new Error(`scan ${scanId} não chegou a estado terminal em ${maxMs}ms`);
}

async function seedActors() {
  const admin = await seedUser({ name: "Admin", email: "admin@vulnera.local", password: PASSWORD, role: "ADMIN" });
  const pentesterA = await seedUser({ name: "Pentester A", email: "penta@vulnera.local", password: PASSWORD, role: "PENTESTER" });
  const pentesterB = await seedUser({ name: "Pentester B", email: "pentb@vulnera.local", password: PASSWORD, role: "PENTESTER" });
  const client = await seedUser({ name: "Client", email: "client@vulnera.local", password: PASSWORD, role: "CLIENT" });

  return {
    admin,
    pentesterA,
    pentesterB,
    client,
    adminToken: await loginAs(app, admin.email, PASSWORD),
    pentesterAToken: await loginAs(app, pentesterA.email, PASSWORD),
    pentesterBToken: await loginAs(app, pentesterB.email, PASSWORD),
    clientToken: await loginAs(app, client.email, PASSWORD),
  };
}

beforeEach(async () => {
  await cleanDatabase();
});

describe("DAST — RBAC", () => {
  it("DAST-RBAC-01..10 — CLIENT recebe 403 em todas as 10 rotas", async () => {
    const { clientToken } = await seedActors();
    const auth = { Authorization: `Bearer ${clientToken}` };
    const fakeId = "id-que-nao-existe";

    const calls = [
      request(app).post("/api/dast/scans").set(auth).send({ mode: "SIMULATED", targetUrl: "https://alvo.test" }),
      request(app).get("/api/dast/scans").set(auth),
      request(app).get(`/api/dast/scans/${fakeId}`).set(auth),
      request(app).post(`/api/dast/scans/${fakeId}/cancel`).set(auth),
      request(app).get(`/api/dast/scans/${fakeId}/findings`).set(auth),
      request(app).get(`/api/dast/scans/${fakeId}/sensors`).set(auth),
      request(app).get(`/api/dast/scans/${fakeId}/assets`).set(auth),
      request(app).get(`/api/dast/scans/${fakeId}/report/html`).set(auth),
      request(app).get(`/api/dast/scans/${fakeId}/report/data`).set(auth),
      request(app).get("/api/dast/scans/status").set(auth),
    ];

    const results = await Promise.all(calls);
    for (const res of results) {
      expect(res.status).toBe(403);
    }
  });

  it("DAST-RBAC-08 — PENTESTER não acessa scan de outro PENTESTER", async () => {
    const { pentesterAToken, pentesterBToken } = await seedActors();

    const createRes = await request(app)
      .post("/api/dast/scans")
      .set("Authorization", `Bearer ${pentesterAToken}`)
      .send({ mode: "SIMULATED", targetUrl: "https://alvo-rbac-08.test" });
    expect(createRes.status).toBe(201);
    const scanId = createRes.body.id;

    const getRes = await request(app).get(`/api/dast/scans/${scanId}`).set("Authorization", `Bearer ${pentesterBToken}`);
    expect(getRes.status).toBe(403);
    expect(getRes.body.error).toBe("FORBIDDEN");

    const cancelRes = await request(app)
      .post(`/api/dast/scans/${scanId}/cancel`)
      .set("Authorization", `Bearer ${pentesterBToken}`);
    expect(cancelRes.status).toBe(403);

    const findingsRes = await request(app)
      .get(`/api/dast/scans/${scanId}/findings`)
      .set("Authorization", `Bearer ${pentesterBToken}`);
    expect(findingsRes.status).toBe(403);

    // limpeza — espera terminar pra não vazar timer pro próximo teste
    await waitForTerminalStatus(pentesterAToken, scanId);
  });

  it("DAST-RBAC-09 — ADMIN enxerga scans de qualquer PENTESTER", async () => {
    const { adminToken, pentesterAToken } = await seedActors();

    const createRes = await request(app)
      .post("/api/dast/scans")
      .set("Authorization", `Bearer ${pentesterAToken}`)
      .send({ mode: "SIMULATED", targetUrl: "https://alvo-rbac-09.test" });
    const scanId = createRes.body.id;

    const listRes = await request(app).get("/api/dast/scans").set("Authorization", `Bearer ${adminToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.some((s: any) => s.id === scanId)).toBe(true);

    const getRes = await request(app).get(`/api/dast/scans/${scanId}`).set("Authorization", `Bearer ${adminToken}`);
    expect(getRes.status).toBe(200);

    await waitForTerminalStatus(pentesterAToken, scanId);
  });

  it("PENTESTER só vê os próprios scans na listagem (não vê o de outro PENTESTER)", async () => {
    const { pentesterAToken, pentesterBToken } = await seedActors();

    const createRes = await request(app)
      .post("/api/dast/scans")
      .set("Authorization", `Bearer ${pentesterAToken}`)
      .send({ mode: "SIMULATED", targetUrl: "https://alvo-visibilidade.test" });
    const scanId = createRes.body.id;

    const listAsB = await request(app).get("/api/dast/scans").set("Authorization", `Bearer ${pentesterBToken}`);
    expect(listAsB.body.some((s: any) => s.id === scanId)).toBe(false);

    const listAsA = await request(app).get("/api/dast/scans").set("Authorization", `Bearer ${pentesterAToken}`);
    expect(listAsA.body.some((s: any) => s.id === scanId)).toBe(true);

    await waitForTerminalStatus(pentesterAToken, scanId);
  });
});

describe("DAST — ciclo de vida", () => {
  it("DAST-LIFE-01 — scan concorrente no mesmo alvo retorna 409", async () => {
    const { pentesterAToken } = await seedActors();
    const targetUrl = "https://alvo-concorrente.test";

    const first = await request(app).post("/api/dast/scans").set("Authorization", `Bearer ${pentesterAToken}`).send({ mode: "SIMULATED", targetUrl });
    expect(first.status).toBe(201);

    const second = await request(app).post("/api/dast/scans").set("Authorization", `Bearer ${pentesterAToken}`).send({ mode: "SIMULATED", targetUrl });
    expect(second.status).toBe(409);
    expect(second.body.error).toBe("SCAN_ALREADY_RUNNING_FOR_TARGET");

    await waitForTerminalStatus(pentesterAToken, first.body.id);

    // depois de terminado, o mesmo alvo pode ser escaneado de novo
    const third = await request(app).post("/api/dast/scans").set("Authorization", `Bearer ${pentesterAToken}`).send({ mode: "SIMULATED", targetUrl });
    expect(third.status).toBe(201);
    await waitForTerminalStatus(pentesterAToken, third.body.id);
  });

  it("DAST-LIFE-02 — cancelamento muda o status pra CANCELLED", async () => {
    const { pentesterAToken } = await seedActors();
    const createRes = await request(app)
      .post("/api/dast/scans")
      .set("Authorization", `Bearer ${pentesterAToken}`)
      .send({ mode: "SIMULATED", targetUrl: "https://alvo-cancelar.test" });
    const scanId = createRes.body.id;

    const cancelRes = await request(app).post(`/api/dast/scans/${scanId}/cancel`).set("Authorization", `Bearer ${pentesterAToken}`);
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.status).toBe("CANCELLED");

    // cancelar de novo (já terminal) -> 422
    const secondCancel = await request(app).post(`/api/dast/scans/${scanId}/cancel`).set("Authorization", `Bearer ${pentesterAToken}`);
    expect(secondCancel.status).toBe(422);
    expect(secondCancel.body.error).toBe("INVALID_STATUS_TRANSITION");
  });

  it("DAST-LIFE-05 — cancelar enquanto roda: a demonstração que termina depois não reescreve a fase CANCELLED", async () => {
    const { pentesterAToken } = await seedActors();
    const createRes = await request(app)
      .post("/api/dast/scans")
      .set("Authorization", `Bearer ${pentesterAToken}`)
      .send({ mode: "SIMULATED", targetUrl: "https://alvo-cancel-tardio.test" });
    const scanId = createRes.body.id;

    // Cancela só depois de RUNNING: a demonstração (3 s) ainda vai terminar em background.
    for (let i = 0; i < 100; i++) {
      if ((await prisma.dastScan.findUnique({ where: { id: scanId } }))?.status === "RUNNING") break;
      await sleep(50);
    }
    const cancelRes = await request(app).post(`/api/dast/scans/${scanId}/cancel`).set("Authorization", `Bearer ${pentesterAToken}`);
    expect(cancelRes.status).toBe(200);

    await sleep(4000);
    const depois = await prisma.dastScan.findUnique({ where: { id: scanId } });
    expect(depois?.status).toBe("CANCELLED");
    expect(depois?.phase).toBe("CANCELLED");
    expect(depois?.progress).toBe(0);
  });

  it("DAST-LIFE-06 — duas criações simultâneas para o mesmo alvo: uma 201 e uma 409", async () => {
    const { pentesterAToken } = await seedActors();
    const targetUrl = "https://alvo-corrida.test";
    const criar = () => request(app).post("/api/dast/scans").set("Authorization", `Bearer ${pentesterAToken}`).send({ mode: "SIMULATED", targetUrl });

    const [a, b] = await Promise.all([criar(), criar()]);
    expect([a.status, b.status].sort((x, y) => x - y)).toEqual([201, 409]);
    const vencedor = a.status === 201 ? a : b;
    const perdedor = a.status === 201 ? b : a;
    expect(perdedor.body.error).toBe("SCAN_ALREADY_RUNNING_FOR_TARGET");

    // O service grava a URL canonicalizada (.href, com "/" no fim), não a digitada.
    const ativos = await prisma.dastScan.count({ where: { targetUrl: new URL(targetUrl).href, status: { in: ["QUEUED", "RUNNING"] } } });
    expect(ativos).toBe(1);

    await request(app).post(`/api/dast/scans/${vencedor.body.id}/cancel`).set("Authorization", `Bearer ${pentesterAToken}`);
  });

  it("DAST-LIFE-03 — timeout marca FAILED com SCAN_TIMEOUT", async () => {
    const original = process.env.DAST_SCAN_TIMEOUT_MS;
    process.env.DAST_SCAN_TIMEOUT_MS = "50"; // bem menor que os 3000ms do fallback simulado
    try {
      const { pentesterAToken } = await seedActors();
      const createRes = await request(app)
        .post("/api/dast/scans")
        .set("Authorization", `Bearer ${pentesterAToken}`)
        .send({ mode: "SIMULATED", targetUrl: "https://alvo-timeout.test" });
      expect(createRes.status).toBe(201);

      const final = await waitForTerminalStatus(pentesterAToken, createRes.body.id);
      expect(final.status).toBe("FAILED");
      expect(final.errorMessage).toContain("SCAN_TIMEOUT");
    } finally {
      if (original === undefined) delete process.env.DAST_SCAN_TIMEOUT_MS;
      else process.env.DAST_SCAN_TIMEOUT_MS = original;
    }
  });

  it("DAST-LIFE-04 — watchdog marca scans QUEUED/RUNNING como FAILED no boot", async () => {
    const { pentesterA } = await seedActors();

    const orphan = await prisma.dastScan.create({
      data: { targetUrl: "https://alvo-orfao.test", requestedById: pentesterA.id, status: "RUNNING", containerName: "vulnera-zap-orfao" },
    });

    const count = await makeDastScanService().recoverOrphanedScans();
    expect(count).toBeGreaterThanOrEqual(1);

    const reloaded = await prisma.dastScan.findUnique({ where: { id: orphan.id } });
    expect(reloaded?.status).toBe("FAILED");
    expect(reloaded?.errorMessage).toBe("Scan interrompido por reinício do servidor");
  });
});

describe("DAST — pipeline com banco real", () => {
  it("DAST-PIPE-03 — reprocessar o mesmo scan não duplica findings", async () => {
    const { pentesterA } = await seedActors();
    const scan = await prisma.dastScan.create({ data: { targetUrl: "https://example.com", requestedById: pentesterA.id } });

    const repository = new DastScanRepository(prisma);
    const candidates = await extractFindingsFromReport(FIXTURE_PATH, "https://example.com");

    const firstRun = await repository.persistFindingsAndUpdateCounters(scan.id, candidates);
    const countAfterFirst = await prisma.dastFinding.count({ where: { scanId: scan.id } });

    const secondRun = await repository.persistFindingsAndUpdateCounters(scan.id, candidates);
    const countAfterSecond = await prisma.dastFinding.count({ where: { scanId: scan.id } });

    expect(countAfterFirst).toBe(candidates.length);
    expect(countAfterSecond).toBe(countAfterFirst); // reprocessar não duplicou
    expect(secondRun).toEqual(firstRun); // contadores idênticos nas duas rodadas
  });

  it("DAST-PIPE-04 — contadores do DastScan batem com SELECT/groupBy em DastFinding", async () => {
    const { pentesterA } = await seedActors();
    const scan = await prisma.dastScan.create({ data: { targetUrl: "https://example.com", requestedById: pentesterA.id } });

    const repository = new DastScanRepository(prisma);
    const candidates = await extractFindingsFromReport(FIXTURE_PATH, "https://example.com");
    await repository.persistFindingsAndUpdateCounters(scan.id, candidates);

    const updatedScan = await prisma.dastScan.findUniqueOrThrow({ where: { id: scan.id } });
    const grouped = await prisma.dastFinding.groupBy({ by: ["risk"], where: { scanId: scan.id }, _count: { _all: true } });
    const byRisk: Record<string, number> = {};
    for (const g of grouped) byRisk[g.risk] = g._count._all;

    expect(updatedScan.alertsHigh).toBe(byRisk.HIGH ?? 0);
    expect(updatedScan.alertsMedium).toBe(byRisk.MEDIUM ?? 0);
    expect(updatedScan.alertsLow).toBe(byRisk.LOW ?? 0);
    expect(updatedScan.alertsInfo).toBe(byRisk.INFO ?? 0);

    const totalFindings = await prisma.dastFinding.count({ where: { scanId: scan.id } });
    expect(updatedScan.alertsHigh + updatedScan.alertsMedium + updatedScan.alertsLow + updatedScan.alertsInfo).toBe(totalFindings);
  });
});

describe("DAST — fluxo feliz completo", () => {
  it("cria, roda (simulado), persiste findings e serve report/data e report/html", async () => {
    const { pentesterAToken } = await seedActors();
    const createRes = await request(app)
      .post("/api/dast/scans")
      .set("Authorization", `Bearer ${pentesterAToken}`)
      .send({ mode: "SIMULATED", targetUrl: "https://alvo-fluxo-feliz.test" });
    expect(createRes.status).toBe(201);
    expect(createRes.body.status).toBe("QUEUED");

    const final = await waitForTerminalStatus(pentesterAToken, createRes.body.id);
    expect(final.status).toBe("COMPLETED");
    expect(final.alertsHigh + final.alertsMedium + final.alertsLow + final.alertsInfo).toBeGreaterThan(0);

    const findingsRes = await request(app)
      .get(`/api/dast/scans/${createRes.body.id}/findings`)
      .set("Authorization", `Bearer ${pentesterAToken}`);
    expect(findingsRes.status).toBe(200);
    expect(findingsRes.body.length).toBeGreaterThan(0);

    const reportDataRes = await request(app)
      .get(`/api/dast/scans/${createRes.body.id}/report/data`)
      .set("Authorization", `Bearer ${pentesterAToken}`);
    expect(reportDataRes.status).toBe(200);
    expect(reportDataRes.body.scan.id).toBe(createRes.body.id);
    expect(reportDataRes.body.topFindings.length).toBeLessThanOrEqual(10);
    expect(reportDataRes.body.discovery).toBeNull();

    const reportHtmlRes = await request(app)
      .get(`/api/dast/scans/${createRes.body.id}/report/html`)
      .set("Authorization", `Bearer ${pentesterAToken}`);
    expect(reportHtmlRes.status).toBe(200);
    expect(reportHtmlRes.headers["content-type"]).toContain("text/html");
    expect(reportHtmlRes.headers["content-security-policy"]).toBe("sandbox");
    expect(reportHtmlRes.headers["x-content-type-options"]).toBe("nosniff");
  });
});

describe("DAST — sensores passivos", () => {
  it("DAST-SENS-01 — scan simulado registra ZAP e todos os sensores, e os findings do sensor vêm com sensorKey", async () => {
    const { pentesterAToken } = await seedActors();
    const auth = { Authorization: `Bearer ${pentesterAToken}` };
    const createRes = await request(app).post("/api/dast/scans").set(auth).send({ mode: "SIMULATED", targetUrl: "https://alvo-sensores.test" });
    const final = await waitForTerminalStatus(pentesterAToken, createRes.body.id);
    expect(final.status).toBe("COMPLETED");

    const sensores = await request(app).get(`/api/dast/scans/${createRes.body.id}/sensors`).set(auth);
    expect(sensores.status).toBe(200);
    expect(sensores.body.map((s: { sensorKey: string }) => s.sensorKey)).toEqual(["zap", "headers", "ssl", "fingerprint", "internetdb", "crtsh"]);
    expect(sensores.body.every((s: { status: string }) => s.status === "OK")).toBe(true);
    const headers = sensores.body.find((s: { sensorKey: string }) => s.sensorKey === "headers");
    expect(headers.status).toBe("OK");
    // Simulado é rotulado como simulado: nunca passa por medição real.
    expect(headers.message).toMatch(/simulado/i);

    const findings = await request(app).get(`/api/dast/scans/${createRes.body.id}/findings`).set(auth);
    const doSensor = findings.body.filter((f: { sensorKey: string }) => f.sensorKey === "headers");
    expect(doSensor.length).toBeGreaterThan(0);
    expect(doSensor.every((f: { pluginId: string; triageStatus: string }) => f.pluginId.startsWith("sensor:headers:") && f.triageStatus === "NEW")).toBe(true);
    expect(findings.body.some((f: { sensorKey: string }) => f.sensorKey === "zap")).toBe(true);
    // Contadores incluem os findings do sensor.
    const total = final.alertsHigh + final.alertsMedium + final.alertsLow + final.alertsInfo;
    expect(total).toBe(findings.body.length);
  });

  it("DAST-SENS-03 — scan simulado devolve IP, portas e CVEs com CVSS, rotulados como potenciais", async () => {
    const { pentesterAToken } = await seedActors();
    const auth = { Authorization: `Bearer ${pentesterAToken}` };
    const createRes = await request(app).post("/api/dast/scans").set(auth).send({ mode: "SIMULATED", targetUrl: "https://alvo-cves.test" });
    await waitForTerminalStatus(pentesterAToken, createRes.body.id);

    const assets = await request(app).get(`/api/dast/scans/${createRes.body.id}/assets`).set(auth);
    expect(assets.status).toBe(200);
    const kinds = new Set(assets.body.map((a: { kind: string }) => a.kind));
    expect([...kinds].sort()).toEqual(["IP", "PORT", "SUBDOMAIN", "TECHNOLOGY"]);
    const portas = assets.body.filter((a: { kind: string }) => a.kind === "PORT");
    expect(portas.every((p: { parentValue: string }) => p.parentValue === "203.0.113.10")).toBe(true);

    const findings = await request(app).get(`/api/dast/scans/${createRes.body.id}/findings`).set(auth);
    const cves = findings.body.filter((f: { cveId: string | null }) => f.cveId);
    expect(cves.length).toBeGreaterThan(0);
    for (const f of cves) {
      expect(f.sensorKey).toBe("internetdb");
      expect(f.title).toMatch(/potencial · não validado/);
      expect(typeof f.cvssScore).toBe("number");
      expect(f.cvssVector).toMatch(/^CVSS:3\.1\//);
      expect(f.triageStatus).toBe("NEW");
    }
    const critica = cves.find((f: { cveId: string }) => f.cveId === "CVE-2021-42013");
    expect(critica).toMatchObject({ cvssScore: 9.8, risk: "HIGH" });
  });

  it("DAST-SENS-04 — PENTESTER não lê os ativos de scan de outro PENTESTER", async () => {
    const { pentesterAToken, pentesterBToken } = await seedActors();
    const createRes = await request(app)
      .post("/api/dast/scans")
      .set("Authorization", `Bearer ${pentesterAToken}`)
      .send({ mode: "SIMULATED", targetUrl: "https://alvo-ativos-dono.test" });
    await waitForTerminalStatus(pentesterAToken, createRes.body.id);
    const res = await request(app).get(`/api/dast/scans/${createRes.body.id}/assets`).set("Authorization", `Bearer ${pentesterBToken}`);
    expect(res.status).toBe(403);
    const inexistente = await request(app).get("/api/dast/scans/nao-existe/assets").set("Authorization", `Bearer ${pentesterAToken}`);
    expect(inexistente.status).toBe(404);
  });

  it("DAST-SENS-02 — PENTESTER não lê os sensores de scan de outro PENTESTER", async () => {
    const { pentesterAToken, pentesterBToken } = await seedActors();
    const createRes = await request(app)
      .post("/api/dast/scans")
      .set("Authorization", `Bearer ${pentesterAToken}`)
      .send({ mode: "SIMULATED", targetUrl: "https://alvo-sensores-dono.test" });
    await waitForTerminalStatus(pentesterAToken, createRes.body.id);
    const res = await request(app).get(`/api/dast/scans/${createRes.body.id}/sensors`).set("Authorization", `Bearer ${pentesterBToken}`);
    expect(res.status).toBe(403);
  });
});

describe("DAST — progresso, resultado simulado e status do módulo", () => {
  it("DAST-PROG-01 — o DTO carrega progresso e fase, e termina em 100%", async () => {
    const { pentesterAToken } = await seedActors();
    const createRes = await request(app)
      .post("/api/dast/scans")
      .set("Authorization", `Bearer ${pentesterAToken}`)
      .send({ mode: "SIMULATED", targetUrl: "https://alvo-progresso.test" });

    expect(createRes.status).toBe(201);
    // Recém-criado: a barra existe e está zerada (não é undefined — a UI
    // desenharia NaN%).
    expect(createRes.body.progress).toBe(0);

    const final = await waitForTerminalStatus(pentesterAToken, createRes.body.id);
    expect(final.status).toBe("COMPLETED");
    expect(final.progress).toBe(100);
    // Simulado termina em SIMULATED; scan real termina em DONE.
    expect(["DONE", "SIMULATED"]).toContain(final.phase);
  });

  it("DAST-SIM-01 — scan simulado é carimbado como tal e explica o motivo em PT-BR", async () => {
    // .env.test liga DAST_FORCE_SIMULATE — todo scan da suíte é simulado, que
    // é exatamente o caso que precisa ficar VISÍVEL na aplicação
    // (docs/DAST-DOCKER-GAP.md §5: antes disso era indistinguível de um real).
    const { pentesterAToken } = await seedActors();
    const createRes = await request(app)
      .post("/api/dast/scans")
      .set("Authorization", `Bearer ${pentesterAToken}`)
      .send({ mode: "SIMULATED", targetUrl: "https://alvo-simulado.test" });

    const final = await waitForTerminalStatus(pentesterAToken, createRes.body.id);
    expect(final.status).toBe("COMPLETED");
    expect(final.simulated).toBe(true);
    expect(typeof final.warningMessage).toBe("string");
    expect(final.warningMessage.toLowerCase()).toContain("demonstração");
    // errorMessage continua reservado a FAILED — um scan concluído com
    // ressalva não é um scan com erro.
    expect(final.errorMessage).toBeNull();
  });

  it("DAST-STAT-01 — GET /status expõe o limite de concorrência e o estado do motor", async () => {
    const { pentesterAToken } = await seedActors();
    const res = await request(app).get("/api/dast/scans/status").set("Authorization", `Bearer ${pentesterAToken}`);

    expect(res.status).toBe(200);
    expect(res.body.maxConcurrent).toBeGreaterThanOrEqual(1);
    expect(typeof res.body.dockerAvailable).toBe("boolean");
    expect(typeof res.body.runningCount).toBe("number");
    expect(typeof res.body.queuedCount).toBe("number");
    expect(Array.isArray(res.body.running)).toBe(true);
    expect(Array.isArray(res.body.queued)).toBe(true);
    expect(Array.isArray(res.body.alerts)).toBe(true);
  });

  it("a rota literal /status não é engolida pela paramétrica /:id", async () => {
    const { adminToken } = await seedActors();
    const res = await request(app).get("/api/dast/scans/status").set("Authorization", `Bearer ${adminToken}`);
    // Se a ordem das rotas estivesse errada, "status" viraria um id de scan e
    // a resposta seria 404 SCAN_NOT_FOUND.
    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty("error");
  });
});


describe("DAST — modo explícito e confirmação obrigatória", () => {
  it("rejeita modo ausente/inválido e real sem confirmação literal true", async () => {
    const { pentesterAToken } = await seedActors();
    for (const body of [
      { targetUrl: "https://example.com" },
      { targetUrl: "https://example.com", mode: "invalid" },
      { targetUrl: "https://example.com", mode: "REAL" },
      { targetUrl: "https://example.com", mode: "REAL", confirmedRealScan: "true" },
    ]) {
      const res = await request(app).post("/api/dast/scans").set("Authorization", `Bearer ${pentesterAToken}`).send(body);
      expect(res.status).toBe(400);
    }
    expect(await prisma.dastScan.count()).toBe(0);
  });

  it("real em ambiente de demo falha com mensagem tratada sem mockar achados", async () => {
    const { pentesterAToken } = await seedActors();
    const original = process.env.DAST_FORCE_SIMULATE;
    process.env.DAST_FORCE_SIMULATE = "true";
    try {
      const res = await request(app).post("/api/dast/scans").set("Authorization", `Bearer ${pentesterAToken}`)
        .send({ targetUrl: "https://example.com", mode: "REAL", confirmedRealScan: true });
      expect(res.status).toBe(201);
      const final = await waitForTerminalStatus(pentesterAToken, res.body.id);
      expect(final.status).toBe("FAILED");
      expect(final.simulated).toBe(false);
      expect(final.errorMessage).toContain("REAL_SCAN_DISABLED");
      expect(final.errorMessage).toContain("Desative DAST_FORCE_SIMULATE");
      expect(await prisma.dastFinding.count()).toBe(0);
    } finally {
      if (original === undefined) delete process.env.DAST_FORCE_SIMULATE;
      else process.env.DAST_FORCE_SIMULATE = original;
    }
  });

  it("DAST-NET-01 — aceita alvo LAN real confirmado com flag legada false e preserva ownership", async () => {
    const { pentesterAToken, pentesterBToken, adminToken } = await seedActors();
    const originalForceSimulate = process.env.DAST_FORCE_SIMULATE;
    const originalPrivateTargets = process.env.DAST_ALLOW_PRIVATE_TARGETS;
    // O runner deve parar antes de consultar Docker ou acessar a rede real.
    process.env.DAST_FORCE_SIMULATE = "true";
    process.env.DAST_ALLOW_PRIVATE_TARGETS = "false";
    try {
      const res = await request(app).post("/api/dast/scans").set("Authorization", `Bearer ${pentesterAToken}`)
        .send({ targetUrl: "http://192.168.0.1:5173/#inicio", mode: "REAL", confirmedRealScan: true });
      expect(res.status).toBe(201);
      expect(res.body.targetUrl).toBe("http://192.168.0.1:5173/");
      expect(res.body.simulated).toBe(false);

      const final = await waitForTerminalStatus(pentesterAToken, res.body.id);
      expect(final.status).toBe("FAILED");
      expect(final.simulated).toBe(false);
      expect(final.errorMessage).toContain("REAL_SCAN_DISABLED");
      expect(final.warningMessage).toBeNull();
      expect(await prisma.dastFinding.count({ where: { scanId: res.body.id } })).toBe(0);

      const forbidden = await request(app).get(`/api/dast/scans/${res.body.id}`)
        .set("Authorization", `Bearer ${pentesterBToken}`);
      expect(forbidden.status).toBe(403);
      expect(forbidden.body.error).toBe("FORBIDDEN");

      const admin = await request(app).get(`/api/dast/scans/${res.body.id}`)
        .set("Authorization", `Bearer ${adminToken}`);
      expect(admin.status).toBe(200);
      expect(admin.body.id).toBe(res.body.id);
    } finally {
      if (originalForceSimulate === undefined) delete process.env.DAST_FORCE_SIMULATE;
      else process.env.DAST_FORCE_SIMULATE = originalForceSimulate;
      if (originalPrivateTargets === undefined) delete process.env.DAST_ALLOW_PRIVATE_TARGETS;
      else process.env.DAST_ALLOW_PRIVATE_TARGETS = originalPrivateTargets;
    }
  });

  it("DAST-NET-02 — alvo privado real continua exigindo confirmação literal true", async () => {
    const { pentesterAToken } = await seedActors();
    for (const confirmedRealScan of [undefined, false, "true"]) {
      const res = await request(app).post("/api/dast/scans").set("Authorization", `Bearer ${pentesterAToken}`)
        .send({ targetUrl: "http://192.168.0.1:5173/", mode: "REAL", confirmedRealScan });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("REAL_SCAN_CONFIRMATION_REQUIRED");
    }
    expect(await prisma.dastScan.count()).toBe(0);
  });

  it("DAST-NET-03 — liberar alvos privados preserva autenticação e CLIENT proibido", async () => {
    const { clientToken } = await seedActors();
    const body = { targetUrl: "http://192.168.0.1:5173/", mode: "REAL", confirmedRealScan: true };
    const unauthenticated = await request(app).post("/api/dast/scans").send(body);
    expect(unauthenticated.status).toBe(401);
    const client = await request(app).post("/api/dast/scans").set("Authorization", `Bearer ${clientToken}`).send(body);
    expect(client.status).toBe(403);
    expect(client.body.error).toBe("FORBIDDEN");
    expect(await prisma.dastScan.count()).toBe(0);
  });
});

describe("DAST — procedência da descoberta por execução", () => {
  it("DAST-DISC-01 — histórico sem artefato não ganha perfil Spider e metadados novos preservam ownership", async () => {
    const { pentesterA, pentesterAToken, pentesterBToken } = await seedActors();
    const scan = await prisma.dastScan.create({ data: {
      targetUrl: "http://192.168.0.1:5173/", requestedById: pentesterA.id, status: "COMPLETED", simulated: false,
    } });
    const route = `/api/dast/scans/${scan.id}/report/data`;
    const legacy = await request(app).get(route).set("Authorization", `Bearer ${pentesterAToken}`);
    expect(legacy.status).toBe(200);
    expect(legacy.body.discovery).toBeNull();
    const artifact = resolveReportPath(scan.id, "discovery.json");
    await fs.mkdir(path.dirname(artifact), { recursive: true });
    const metadata = { profile: "TRADITIONAL_SPIDER_PASSIVE", targetUrl: scan.targetUrl,
      urls: [scan.targetUrl, `${scan.targetUrl}api/status`, "http://outro.test/private", `${scan.targetUrl}logout`],
      limits: { maxDurationMin: 1, maxDepth: 2, maxChildrenPerNode: 30, threadCount: 1, maxParseSizeBytes: 1000000 },
      processForms: false, javascript: false, activeScan: false, apiKey: "nao-deve-vazar" };
    try {
      await fs.writeFile(artifact, JSON.stringify(metadata), "utf8");
      const current = await request(app).get(route).set("Authorization", `Bearer ${pentesterAToken}`);
      expect(current.status).toBe(200);
      expect(current.body.discovery.profile).toBe("TRADITIONAL_SPIDER_PASSIVE");
      expect(current.body.discovery.urls).toEqual([scan.targetUrl, `${scan.targetUrl}api/status`]);
      expect(current.body.discovery).not.toHaveProperty("apiKey");
      const foreign = await request(app).get(route).set("Authorization", `Bearer ${pentesterBToken}`);
      expect(foreign.status).toBe(403);
      expect(foreign.body.discovery).toBeUndefined();
      await fs.writeFile(artifact, JSON.stringify({ ...metadata, targetUrl: "http://outro.test/" }), "utf8");
      const invalid = await request(app).get(route).set("Authorization", `Bearer ${pentesterAToken}`);
      expect(invalid.body.discovery).toBeNull();
    } finally {
      await fs.unlink(artifact);
    }
  });
});

describe("DAST — tenant do scan (ADR-056)", () => {
  /** Duas empresas, cada uma com aplicação e projeto; o PENTESTER A é membro só do projeto da empresa A. */
  async function seedTenants() {
    const actors = await seedActors();
    const plan = await seedPlan({ name: "Plano DAST" });
    const companyA = await seedCompany({ name: "Empresa A", planId: plan.id });
    const companyB = await seedCompany({ name: "Empresa B", planId: plan.id });
    const appA = await seedApplication({ name: "App A", companyId: companyA.id, url: "https://app-a.test" });
    const appB = await seedApplication({ name: "App B", companyId: companyB.id, url: "https://app-b.test" });
    const projectA = await seedProject({ name: "Projeto A", applicationId: appA.id, companyId: companyA.id });
    const projectB = await seedProject({ name: "Projeto B", applicationId: appB.id, companyId: companyB.id });
    await seedProjectMember(projectA.id, actors.pentesterA.id);
    return { ...actors, companyA, companyB, appA, appB, projectA, projectB };
  }

  it("DAST-TEN-01 — scan sem aplicação continua sem tenant e com trigger MANUAL", async () => {
    const { pentesterAToken } = await seedActors();
    const res = await request(app)
      .post("/api/dast/scans")
      .set("Authorization", `Bearer ${pentesterAToken}`)
      .send({ mode: "SIMULATED", targetUrl: "https://sem-tenant.test" });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ companyId: null, applicationId: null, projectId: null, trigger: "MANUAL", scheduleId: null });
    await waitForTerminalStatus(pentesterAToken, res.body.id);
  });

  it("DAST-TEN-02 — companyId vem da Application, e o companyId do body é ignorado (SEC2)", async () => {
    const t = await seedTenants();
    const res = await request(app)
      .post("/api/dast/scans")
      .set("Authorization", `Bearer ${t.pentesterAToken}`)
      .send({ mode: "SIMULATED", targetUrl: "https://app-a.test", projectId: t.projectA.id, companyId: t.companyB.id });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ companyId: t.companyA.id, applicationId: t.appA.id, projectId: t.projectA.id });

    const audit = await prisma.auditLog.findFirst({ where: { entityType: "DastScan", entityId: res.body.id, action: "CREATE" } });
    expect(audit?.companyId).toBe(t.companyA.id);
    await waitForTerminalStatus(t.pentesterAToken, res.body.id);
  });

  it("DAST-TEN-03 — PENTESTER sem vínculo com o projeto/aplicação da empresa B recebe 403", async () => {
    const t = await seedTenants();
    const auth = { Authorization: `Bearer ${t.pentesterAToken}` };
    const byProject = await request(app).post("/api/dast/scans").set(auth).send({ mode: "SIMULATED", targetUrl: "https://app-b.test", projectId: t.projectB.id });
    expect(byProject.status).toBe(403);
    const byApp = await request(app).post("/api/dast/scans").set(auth).send({ mode: "SIMULATED", targetUrl: "https://app-b.test", applicationId: t.appB.id });
    expect(byApp.status).toBe(403);
    expect(await prisma.dastScan.count()).toBe(0);
  });

  it("DAST-TEN-04 — PENTESTER membro de um projeto da aplicação pode vincular só a aplicação", async () => {
    const t = await seedTenants();
    const res = await request(app)
      .post("/api/dast/scans")
      .set("Authorization", `Bearer ${t.pentesterAToken}`)
      .send({ mode: "SIMULATED", targetUrl: "https://app-a.test", applicationId: t.appA.id });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ companyId: t.companyA.id, applicationId: t.appA.id, projectId: null });
    await waitForTerminalStatus(t.pentesterAToken, res.body.id);
  });

  it("DAST-TEN-05 — projeto de outra aplicação, aplicação inexistente ou inativa são recusados", async () => {
    const t = await seedTenants();
    const auth = { Authorization: `Bearer ${t.adminToken}` };
    const mismatch = await request(app).post("/api/dast/scans").set(auth).send({ mode: "SIMULATED", targetUrl: "https://x.test", applicationId: t.appA.id, projectId: t.projectB.id });
    expect(mismatch.status).toBe(400);
    expect(mismatch.body.error).toBe("PROJECT_APPLICATION_MISMATCH");

    const missing = await request(app).post("/api/dast/scans").set(auth).send({ mode: "SIMULATED", targetUrl: "https://x.test", applicationId: "nao-existe" });
    expect(missing.status).toBe(404);

    await prisma.application.update({ where: { id: t.appB.id }, data: { isActive: false } });
    const inactive = await request(app).post("/api/dast/scans").set(auth).send({ mode: "SIMULATED", targetUrl: "https://x.test", applicationId: t.appB.id });
    expect(inactive.status).toBe(404);

    const badType = await request(app).post("/api/dast/scans").set(auth).send({ mode: "SIMULATED", targetUrl: "https://x.test", applicationId: 42 });
    expect(badType.status).toBe(400);
    expect(await prisma.dastScan.count()).toBe(0);
  });

  it("DAST-TEN-06 — vincular tenant não muda a visibilidade: outro PENTESTER do mesmo projeto não vê o scan", async () => {
    const t = await seedTenants();
    await seedProjectMember(t.projectA.id, t.pentesterB.id);
    const created = await request(app)
      .post("/api/dast/scans")
      .set("Authorization", `Bearer ${t.pentesterAToken}`)
      .send({ mode: "SIMULATED", targetUrl: "https://app-a.test", projectId: t.projectA.id });
    expect(created.status).toBe(201);

    const listB = await request(app).get("/api/dast/scans").set("Authorization", `Bearer ${t.pentesterBToken}`);
    expect(listB.body.map((s: any) => s.id)).not.toContain(created.body.id);
    const detailB = await request(app).get(`/api/dast/scans/${created.body.id}`).set("Authorization", `Bearer ${t.pentesterBToken}`);
    expect(detailB.status).toBe(403);
    await waitForTerminalStatus(t.pentesterAToken, created.body.id);
  });
});

describe("DAST — execução pela fila (ADR-056, Fase 4)", () => {
  const service = () => makeDastScanService();

  it("DAST-FILA-01 — processarDaFila ignora scan que não está QUEUED e não mexe nele", async () => {
    const { pentesterA } = await seedActors();
    for (const status of ["CANCELLED", "FAILED", "COMPLETED", "RUNNING"] as const) {
      const scan = await prisma.dastScan.create({ data: { targetUrl: `https://fila-${status}.test`, requestedById: pentesterA.id, status } });
      await expect(service().processarDaFila(scan.id)).resolves.toBe("ignorado");
      expect((await prisma.dastScan.findUnique({ where: { id: scan.id } }))?.status).toBe(status);
    }
    await expect(service().processarDaFila("nao-existe")).resolves.toBe("ignorado");
  });

  it("DAST-FILA-02 — processarDaFila executa o scan QUEUED até o fim e só resolve depois", async () => {
    const { pentesterA, pentesterAToken } = await seedActors();
    const scan = await prisma.dastScan.create({ data: { targetUrl: "https://fila-ok.test", requestedById: pentesterA.id, simulated: true } });
    await expect(service().processarDaFila(scan.id)).resolves.toBe("executado");
    const final = await waitForTerminalStatus(pentesterAToken, scan.id, 1000);
    expect(final.status).toBe("COMPLETED");
  });

  it("DAST-FILA-03 — o mesmo job entregue duas vezes executa uma vez só", async () => {
    const { pentesterA } = await seedActors();
    const scan = await prisma.dastScan.create({ data: { targetUrl: "https://fila-dup.test", requestedById: pentesterA.id, simulated: true } });
    const resultados = await Promise.all([service().processarDaFila(scan.id), service().processarDaFila(scan.id)]);
    expect(resultados.sort()).toEqual(["executado", "ignorado"]);
    const audit = await prisma.auditLog.count({ where: { entityType: "DastScan", entityId: scan.id, action: "STATUS_CHANGE" } });
    expect(audit).toBe(1);
  });

  it("DAST-FILA-04 — cancelado antes de o worker pegar nunca volta a RUNNING", async () => {
    const { pentesterA, pentesterAToken } = await seedActors();
    // O motor memory (testes) começa o scan na hora; para simular "cancelado
    // ainda na fila do Redis", cria o registro QUEUED direto e cancela pela API.
    const scan = await prisma.dastScan.create({ data: { targetUrl: "https://fila-cancel.test", requestedById: pentesterA.id, simulated: true } });
    const cancel = await request(app).post(`/api/dast/scans/${scan.id}/cancel`).set("Authorization", `Bearer ${pentesterAToken}`);
    expect(cancel.status).toBe(200);
    await expect(service().processarDaFila(scan.id)).resolves.toBe("ignorado");
    expect((await prisma.dastScan.findUnique({ where: { id: scan.id } }))?.status).toBe("CANCELLED");
  });

  it("DAST-FILA-05 — job perdido: scan QUEUED vira FAILED com o motivo; scan já iniciado não é tocado", async () => {
    const { pentesterA } = await seedActors();
    const queued = await prisma.dastScan.create({ data: { targetUrl: "https://fila-perdido.test", requestedById: pentesterA.id } });
    const done = await prisma.dastScan.create({ data: { targetUrl: "https://fila-feito.test", requestedById: pentesterA.id, status: "COMPLETED" } });
    await expect(service().marcarFalhaDaFila(queued.id, "job stalled more than allowable limit")).resolves.toBe(true);
    await expect(service().marcarFalhaDaFila(done.id, "x")).resolves.toBe(false);
    const q = await prisma.dastScan.findUnique({ where: { id: queued.id } });
    expect(q).toMatchObject({ status: "FAILED", phase: "FAILED" });
    expect(q?.errorMessage).toMatch(/Falha na fila de execução: job stalled/);
    expect((await prisma.dastScan.findUnique({ where: { id: done.id } }))?.status).toBe("COMPLETED");
  });

  it("DAST-FILA-06 — boot com fila: RUNNING vira FAILED, QUEUED sobrevive e é garantido na fila em ordem", async () => {
    const { pentesterA } = await seedActors();
    const running = await prisma.dastScan.create({ data: { targetUrl: "https://boot-run.test", requestedById: pentesterA.id, status: "RUNNING", simulated: true } });
    const q1 = await prisma.dastScan.create({ data: { targetUrl: "https://boot-q1.test", requestedById: pentesterA.id, createdAt: new Date(Date.now() - 60_000) } });
    const q2 = await prisma.dastScan.create({ data: { targetUrl: "https://boot-q2.test", requestedById: pentesterA.id } });

    const garantidos: string[] = [];
    const r = await service().recuperarParaFila(async (id) => {
      garantidos.push(id);
      return id === q2.id; // q2 "sumiu" do Redis e precisou voltar
    });

    expect(r).toEqual({ falhados: 1, reenfileirados: 1, naFila: 2 });
    expect(garantidos).toEqual([q1.id, q2.id]);
    expect((await prisma.dastScan.findUnique({ where: { id: running.id } }))?.status).toBe("FAILED");
    expect((await prisma.dastScan.findUnique({ where: { id: q1.id } }))?.status).toBe("QUEUED");
    expect((await prisma.dastScan.findUnique({ where: { id: q2.id } }))?.status).toBe("QUEUED");
  });
});
