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
  it("DAST-RBAC-01..08 — CLIENT recebe 403 em todas as 8 rotas", async () => {
    const { clientToken } = await seedActors();
    const auth = { Authorization: `Bearer ${clientToken}` };
    const fakeId = "id-que-nao-existe";

    const calls = [
      request(app).post("/api/dast/scans").set(auth).send({ mode: "SIMULATED", targetUrl: "https://alvo.test" }),
      request(app).get("/api/dast/scans").set(auth),
      request(app).get(`/api/dast/scans/${fakeId}`).set(auth),
      request(app).post(`/api/dast/scans/${fakeId}/cancel`).set(auth),
      request(app).get(`/api/dast/scans/${fakeId}/findings`).set(auth),
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

    const reportHtmlRes = await request(app)
      .get(`/api/dast/scans/${createRes.body.id}/report/html`)
      .set("Authorization", `Bearer ${pentesterAToken}`);
    expect(reportHtmlRes.status).toBe(200);
    expect(reportHtmlRes.headers["content-type"]).toContain("text/html");
    expect(reportHtmlRes.headers["content-security-policy"]).toBe("sandbox");
    expect(reportHtmlRes.headers["x-content-type-options"]).toBe("nosniff");
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
