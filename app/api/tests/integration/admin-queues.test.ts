/**
 * admin-queues.test.ts — painel de filas do ADMIN (ADR-056).
 * Banco real. Os testes rodam com QUEUE_DRIVER ausente ou `memory` (padrão):
 * o painel responde driver "memory" sem filas, e o reprocessamento é recusado
 * com QUEUE_DRIVER_MEMORY. O motor bullmq é coberto por tests/unit/queue-admin.test.ts.
 *
 *   QADM-01  ADMIN lista o painel: driver memory e nenhuma fila
 *   QADM-02  PENTESTER e CLIENT recebem 403 no painel e no reprocessamento
 *   QADM-03  sem token: 401
 *   QADM-04  reprocessar com motor memory: 409 QUEUE_DRIVER_MEMORY e nenhum AuditLog
 *   QADM-05  nome de fila fora de QUEUE_NAMES: 400 INVALID_QUEUE
 */

import request from "supertest";
import { app } from "../../src/app";
import { cleanDatabase } from "../setup";
import { prisma } from "../../src/database/prisma.database";
import { seedUser } from "../fixtures/users.fixture";
import { loginAs } from "../fixtures/auth.fixture";
import { seedPlan } from "../fixtures/plans.fixture";
import { seedCompany } from "../fixtures/companies.fixture";

const PASSWORD = "senha12345";

beforeEach(async () => {
  await cleanDatabase();
});

async function cenario() {
  const plan = await seedPlan({ name: "Plano" });
  const company = await seedCompany({ name: "Empresa", planId: plan.id });
  const admin = await seedUser({ name: "Admin", email: "admin-filas@t.local", password: PASSWORD, role: "ADMIN" });
  const pentester = await seedUser({ name: "Pent", email: "pent-filas@t.local", password: PASSWORD, role: "PENTESTER" });
  const cliente = await seedUser({
    name: "Cliente",
    email: "cli-filas@t.local",
    password: PASSWORD,
    role: "CLIENT",
    companyId: company.id,
    companyRole: "OWNER",
  });
  const tok = async (email: string) => ({ Authorization: `Bearer ${await loginAs(app, email, PASSWORD)}` });
  return { admin: await tok(admin.email), pentester: await tok(pentester.email), cliente: await tok(cliente.email) };
}

describe("GET /api/admin/queues", () => {
  it("QADM-01 — ADMIN recebe o painel com driver memory e nenhuma fila", async () => {
    const h = await cenario();
    const res = await request(app).get("/api/admin/queues").set(h.admin);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ driver: "memory", queues: [] });
  });

  it("QADM-02 — PENTESTER e CLIENT recebem 403", async () => {
    const h = await cenario();
    expect((await request(app).get("/api/admin/queues").set(h.pentester)).status).toBe(403);
    expect((await request(app).get("/api/admin/queues").set(h.cliente)).status).toBe(403);
  });

  it("QADM-03 — sem token: 401", async () => {
    await cenario();
    const res = await request(app).get("/api/admin/queues");
    expect(res.status).toBe(401);
  });
});

describe("POST /api/admin/queues/:name/jobs/:id/retry", () => {
  it("QADM-04 — motor memory recusa o reprocessamento com 409 e não grava AuditLog", async () => {
    const h = await cenario();
    const res = await request(app).post("/api/admin/queues/dast-scan/jobs/abc/retry").set(h.admin);
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: "QUEUE_DRIVER_MEMORY" });
    expect(await prisma.auditLog.count({ where: { action: "RETRY", entityType: "QueueJob" } })).toBe(0);
  });

  it("QADM-05 — nome de fila desconhecido é 400 INVALID_QUEUE (antes de olhar o motor)", async () => {
    const h = await cenario();
    const res = await request(app).post("/api/admin/queues/nao-existe/jobs/abc/retry").set(h.admin);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "INVALID_QUEUE" });
  });

  it("QADM-02b — PENTESTER e CLIENT não reprocessam: 403; sem token: 401", async () => {
    const h = await cenario();
    expect((await request(app).post("/api/admin/queues/dast-scan/jobs/abc/retry").set(h.pentester)).status).toBe(403);
    expect((await request(app).post("/api/admin/queues/dast-scan/jobs/abc/retry").set(h.cliente)).status).toBe(403);
    expect((await request(app).post("/api/admin/queues/dast-scan/jobs/abc/retry")).status).toBe(401);
  });
});
