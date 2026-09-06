/**
 * dast.test.ts
 *
 * Integração do módulo DAST via HTTP (supertest) + banco de teste real.
 * `DAST_FORCE_SIMULATE=true` no .env.test garante que NENHUM teste aqui
 * depende de Docker — todo scan roda o fallback simulado (~3s, 8 alertas
 * representativos, ver zap-runner.service.ts).
 *
 *   DAST-RBAC-01..07  CLIENT recebe 403 em cada uma das 7 rotas
 *   DAST-RBAC-08      PENTESTER não acessa scan de outro PENTESTER
 *   DAST-RBAC-09      ADMIN acessa todos
 *   DAST-LIFE-01      scan concorrente no mesmo alvo -> 409
 *   DAST-LIFE-02      cancelamento muda status
 *   DAST-LIFE-03      timeout marca FAILED
 *   DAST-LIFE-04      watchdog marca órfãos no boot
 *   DAST-PIPE-03      reprocessar o mesmo scan não duplica
 *   DAST-PIPE-04      contadores batem com SELECT/groupBy
 */

import request from "supertest";
import * as path from "path";
import { app } from "../../src/app";
import { cleanDatabase } from "../setup";
import { prisma } from "../../src/database/prisma.database";
import { seedUser } from "../fixtures/users.fixture";
import { loginAs } from "../fixtures/auth.fixture";
import { DastScanRepository } from "../../src/repositories/dast-scan.repository";
import { extractFindingsFromReport } from "../../src/services/dast-findings.service";
import { makeDastScanService } from "../../src/factories/dast-scan.factory";

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
  it("DAST-RBAC-01..07 — CLIENT recebe 403 em todas as 7 rotas", async () => {
    const { clientToken } = await seedActors();
    const auth = { Authorization: `Bearer ${clientToken}` };
    const fakeId = "id-que-nao-existe";

    const calls = [
      request(app).post("/api/dast/scans").set(auth).send({ targetUrl: "https://alvo.test" }),
      request(app).get("/api/dast/scans").set(auth),
      request(app).get(`/api/dast/scans/${fakeId}`).set(auth),
      request(app).post(`/api/dast/scans/${fakeId}/cancel`).set(auth),
      request(app).get(`/api/dast/scans/${fakeId}/findings`).set(auth),
      request(app).get(`/api/dast/scans/${fakeId}/report/html`).set(auth),
      request(app).get(`/api/dast/scans/${fakeId}/report/data`).set(auth),
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
      .send({ targetUrl: "https://alvo-rbac-08.test" });
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
      .send({ targetUrl: "https://alvo-rbac-09.test" });
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
      .send({ targetUrl: "https://alvo-visibilidade.test" });
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

    const first = await request(app).post("/api/dast/scans").set("Authorization", `Bearer ${pentesterAToken}`).send({ targetUrl });
    expect(first.status).toBe(201);

    const second = await request(app).post("/api/dast/scans").set("Authorization", `Bearer ${pentesterAToken}`).send({ targetUrl });
    expect(second.status).toBe(409);
    expect(second.body.error).toBe("SCAN_ALREADY_RUNNING_FOR_TARGET");

    await waitForTerminalStatus(pentesterAToken, first.body.id);

    // depois de terminado, o mesmo alvo pode ser escaneado de novo
    const third = await request(app).post("/api/dast/scans").set("Authorization", `Bearer ${pentesterAToken}`).send({ targetUrl });
    expect(third.status).toBe(201);
    await waitForTerminalStatus(pentesterAToken, third.body.id);
  });

  it("DAST-LIFE-02 — cancelamento muda o status pra CANCELLED", async () => {
    const { pentesterAToken } = await seedActors();
    const createRes = await request(app)
      .post("/api/dast/scans")
      .set("Authorization", `Bearer ${pentesterAToken}`)
      .send({ targetUrl: "https://alvo-cancelar.test" });
    const scanId = createRes.body.id;

    const cancelRes = await request(app).post(`/api/dast/scans/${scanId}/cancel`).set("Authorization", `Bearer ${pentesterAToken}`);
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.status).toBe("CANCELLED");

    // cancelar de novo (já terminal) -> 422
    const secondCancel = await request(app).post(`/api/dast/scans/${scanId}/cancel`).set("Authorization", `Bearer ${pentesterAToken}`);
    expect(secondCancel.status).toBe(422);
    expect(secondCancel.body.error).toBe("INVALID_STATUS_TRANSITION");
  });

  it("DAST-LIFE-03 — timeout marca FAILED com SCAN_TIMEOUT", async () => {
    const original = process.env.DAST_SCAN_TIMEOUT_MS;
    process.env.DAST_SCAN_TIMEOUT_MS = "50"; // bem menor que os 3000ms do fallback simulado
    try {
      const { pentesterAToken } = await seedActors();
      const createRes = await request(app)
        .post("/api/dast/scans")
        .set("Authorization", `Bearer ${pentesterAToken}`)
        .send({ targetUrl: "https://alvo-timeout.test" });
      expect(createRes.status).toBe(201);

      const final = await waitForTerminalStatus(pentesterAToken, createRes.body.id);
      expect(final.status).toBe("FAILED");
      expect(final.errorMessage).toBe("SCAN_TIMEOUT");
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
      .send({ targetUrl: "https://alvo-fluxo-feliz.test" });
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

    const reportHtmlRes = await request(app)
      .get(`/api/dast/scans/${createRes.body.id}/report/html`)
      .set("Authorization", `Bearer ${pentesterAToken}`);
    expect(reportHtmlRes.status).toBe(200);
    expect(reportHtmlRes.headers["content-type"]).toContain("text/html");
    expect(reportHtmlRes.headers["content-security-policy"]).toBe("sandbox");
    expect(reportHtmlRes.headers["x-content-type-options"]).toBe("nosniff");
  });
});
