/**
 * dast-schedule.test.ts — autorização de DAST e scans agendados (ADR-056, Fase 5).
 * Banco real; `DAST_FORCE_SIMULATE=true` no .env.test: simulado roda em ~3 s
 * e REAL termina FAILED sem tocar o alvo (é o que prova "REAL que falha não
 * vira simulado").
 *
 *   SCHED-TEN-01  empresa B não lista, não cria, não edita nem apaga agendamento da A (404)
 *   SCHED-TEN-02  CLIENT da própria empresa só lê (403 ao escrever); PENTESTER sem vínculo → 404
 *   SCHED-AUTH-01 sem autorização vigente não agenda; autorização guarda o host normalizado
 *   SCHED-CRUD-01 PENTESTER precisa de projeto do qual é membro; companyId do corpo é ignorado
 *   SCHED-EXEC-01 autorização vencida → não roda, lastOutcome + notificação + AuditLog
 *   SCHED-EXEC-02 host diferente → não roda (HOST_MISMATCH)
 *   SCHED-EXEC-03 REAL agendado que falha → FAILED, nunca simulado, e notifica o criador
 *   SCHED-EXEC-04 simulado agendado não entra nas métricas
 *   SCHED-EXEC-05 criador que deixou de ser membro → NOT_MEMBER
 *   SCHED-PAG-01  página /agendamentos: cada papel vê só o próprio recorte
 *   SCHED-PAG-02  alvos para agendar: ADMIN todas, PENTESTER as dele, CLIENT 403
 *   SCHED-URL-01..04 agendamento só por URL: confirmação, visibilidade do time, execução sem tenant
 *   SCHED-URL-01..04 agendamento só por URL: criação, visibilidade do time, execução sem tenant
 */

import request from "supertest";
import { app } from "../../src/app";
import { cleanDatabase } from "../setup";
import { prisma } from "../../src/database/prisma.database";
import { seedUser } from "../fixtures/users.fixture";
import { loginAs } from "../fixtures/auth.fixture";
import { seedPlan } from "../fixtures/plans.fixture";
import { seedCompany } from "../fixtures/companies.fixture";
import { seedApplication } from "../fixtures/applications.fixture";
import { seedProject, seedProjectMember } from "../fixtures/projects.fixture";
import { makeDastScheduleService } from "../../src/factories/dast-schedule.factory";

const PASSWORD = "senha12345";
const DIA = 24 * 3600_000;

beforeEach(async () => {
  await cleanDatabase();
});

async function cenario() {
  const plan = await seedPlan({ name: "Plano" });
  const companyA = await seedCompany({ name: "Empresa A", planId: plan.id });
  const companyB = await seedCompany({ name: "Empresa B", planId: plan.id });
  const appA = await seedApplication({ name: "App A", companyId: companyA.id, url: "https://App-A.example.com:443/login" });
  const appB = await seedApplication({ name: "App B", companyId: companyB.id, url: "https://app-b.example.com" });
  const projectA = await seedProject({ name: "Proj A", applicationId: appA.id, companyId: companyA.id });

  const admin = await seedUser({ name: "Admin", email: "admin@t.local", password: PASSWORD, role: "ADMIN" });
  const pentA = await seedUser({ name: "Pent A", email: "penta@t.local", password: PASSWORD, role: "PENTESTER" });
  const pentOutro = await seedUser({ name: "Pent X", email: "pentx@t.local", password: PASSWORD, role: "PENTESTER" });
  const clientA = await seedUser({ name: "Cli A", email: "clia@t.local", password: PASSWORD, role: "CLIENT", companyId: companyA.id, companyRole: "OWNER" });
  const clientB = await seedUser({ name: "Cli B", email: "clib@t.local", password: PASSWORD, role: "CLIENT", companyId: companyB.id, companyRole: "OWNER" });
  await seedProjectMember(projectA.id, pentA.id);

  const tok = async (email: string) => ({ Authorization: `Bearer ${await loginAs(app, email, PASSWORD)}` });
  return {
    companyA, companyB, appA, appB, projectA, admin, pentA, pentOutro, clientA, clientB,
    h: { admin: await tok(admin.email), pentA: await tok(pentA.email), pentOutro: await tok(pentOutro.email), clientA: await tok(clientA.email), clientB: await tok(clientB.email) },
  };
}

const ate = (dias: number) => new Date(Date.now() + dias * DIA).toISOString();
const corpo = (extra: Record<string, unknown> = {}) => ({ mode: "SIMULATED", frequency: "DAILY", hour: 3, minute: 0, ...extra });

async function autorizarEAgendar(c: Awaited<ReturnType<typeof cenario>>, extra: Record<string, unknown> = {}) {
  const auth = await request(app).put(`/api/applications/${c.appA.id}/dast-authorization`).set(c.h.pentA).send({ until: ate(30) });
  expect(auth.status).toBe(200);
  const res = await request(app).post(`/api/applications/${c.appA.id}/dast-schedules`).set(c.h.pentA).send(corpo({ projectId: c.projectA.id, ...extra }));
  expect(res.status).toBe(201);
  return res.body;
}

/** Espera o scan sair de QUEUED/RUNNING (memory: o watchdog roda no próprio processo). */
async function esperarTerminal(scanId: string, maxMs = 10_000) {
  const fim = Date.now() + maxMs;
  while (Date.now() < fim) {
    const s = await prisma.dastScan.findUnique({ where: { id: scanId } });
    if (s && ["COMPLETED", "FAILED", "CANCELLED"].includes(s.status)) return s;
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`scan ${scanId} não terminou`);
}

/** Aguarda o gancho assíncrono de falha (notificação) depois do markFinished. */
async function esperar<T>(fn: () => Promise<T | null | undefined>, maxMs = 3000): Promise<T> {
  const fim = Date.now() + maxMs;
  while (Date.now() < fim) {
    const v = await fn();
    if (v) return v;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("condição não satisfeita a tempo");
}

describe("Agendamentos DAST — tenancy (SEC4)", () => {
  it("SCHED-TEN-01 — empresa B não lista, não cria, não edita nem apaga agendamento da A", async () => {
    const c = await cenario();
    const sched = await autorizarEAgendar(c);
    const base = `/api/applications/${c.appA.id}`;

    expect((await request(app).get(`${base}/dast-schedules`).set(c.h.clientB)).status).toBe(404);
    expect((await request(app).post(`${base}/dast-schedules`).set(c.h.clientB).send(corpo())).status).toBe(404);
    expect((await request(app).put(`${base}/dast-schedules/${sched.id}`).set(c.h.clientB).send({ hour: 5 })).status).toBe(404);
    expect((await request(app).delete(`${base}/dast-schedules/${sched.id}`).set(c.h.clientB)).status).toBe(404);
    expect((await request(app).get(`${base}/dast-authorization`).set(c.h.clientB)).status).toBe(404);
    // Agendamento da A não é alcançável pela aplicação da B.
    expect((await request(app).put(`/api/applications/${c.appB.id}/dast-schedules/${sched.id}`).set(c.h.admin).send({ hour: 5 })).status).toBe(404);

    const intacto = await prisma.scanSchedule.findUniqueOrThrow({ where: { id: sched.id } });
    expect(intacto.hour).toBe(3);
    expect(await prisma.scanSchedule.count()).toBe(1);
  });

  it("SCHED-TEN-02 — CLIENT da própria empresa só lê; PENTESTER sem vínculo não vê", async () => {
    const c = await cenario();
    const sched = await autorizarEAgendar(c);
    const base = `/api/applications/${c.appA.id}`;

    const lista = await request(app).get(`${base}/dast-schedules`).set(c.h.clientA);
    expect(lista.status).toBe(200);
    expect(lista.body.map((s: { id: string }) => s.id)).toEqual([sched.id]);
    const auth = await request(app).get(`${base}/dast-authorization`).set(c.h.clientA);
    expect(auth.status).toBe(200);
    expect(auth.body.canEdit).toBe(false);

    expect((await request(app).post(`${base}/dast-schedules`).set(c.h.clientA).send(corpo())).status).toBe(403);
    expect((await request(app).put(`${base}/dast-schedules/${sched.id}`).set(c.h.clientA).send({ hour: 5 })).status).toBe(403);
    expect((await request(app).put(`${base}/dast-authorization`).set(c.h.clientA).send({ until: ate(10) })).status).toBe(403);
    expect((await request(app).get(`${base}/dast-schedules`).set(c.h.pentOutro)).status).toBe(404);
  });
});

describe("Agendamentos DAST — autorização e CRUD", () => {
  it("SCHED-AUTH-01 — sem autorização não agenda; a autorização guarda o host normalizado e é auditada", async () => {
    const c = await cenario();
    const base = `/api/applications/${c.appA.id}`;
    const sem = await request(app).post(`${base}/dast-schedules`).set(c.h.admin).send(corpo());
    expect(sem.status).toBe(422);
    expect(sem.body.error).toBe("AUTHORIZATION_MISSING");

    expect((await request(app).put(`${base}/dast-authorization`).set(c.h.admin).send({ until: "ontem" })).status).toBe(400);
    expect((await request(app).put(`${base}/dast-authorization`).set(c.h.admin).send({ until: ate(-1) })).status).toBe(400);

    const ok = await request(app).put(`${base}/dast-authorization`).set(c.h.admin).send({ until: ate(30) });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ host: "app-a.example.com", currentHost: "app-a.example.com", problem: null, canEdit: true });
    expect(await prisma.auditLog.count({ where: { entityType: "Application", entityId: c.appA.id, action: "DAST_AUTHORIZATION_GRANTED", companyId: c.companyA.id } })).toBe(1);

    const revogada = await request(app).delete(`${base}/dast-authorization`).set(c.h.admin);
    expect(revogada.body.problem).toBe("AUTHORIZATION_MISSING");
  });

  it("SCHED-CRUD-01 — PENTESTER precisa de projeto em que é membro; companyId do corpo é ignorado", async () => {
    const c = await cenario();
    await request(app).put(`/api/applications/${c.appA.id}/dast-authorization`).set(c.h.pentA).send({ until: ate(30) });
    const base = `/api/applications/${c.appA.id}/dast-schedules`;

    const semProjeto = await request(app).post(base).set(c.h.pentA).send(corpo());
    expect(semProjeto.body.error).toBe("MISSING_PROJECT_ID");
    expect((await request(app).post(base).set(c.h.pentA).send(corpo({ frequency: "WEEKLY", projectId: c.projectA.id }))).body.error).toBe("INVALID_DAY_OF_WEEK");
    expect((await request(app).post(base).set(c.h.pentA).send(corpo({ hour: 24, projectId: c.projectA.id }))).body.error).toBe("INVALID_HOUR");
    expect((await request(app).post(base).set(c.h.pentA).send(corpo({ timezone: "Marte/Olympus", projectId: c.projectA.id }))).body.error).toBe("INVALID_TIMEZONE");

    const ok = await request(app).post(base).set(c.h.pentA).send(corpo({ projectId: c.projectA.id, companyId: c.companyB.id, frequency: "WEEKLY", dayOfWeek: 1 }));
    expect(ok.status).toBe(201);
    expect(ok.body).toMatchObject({ companyId: c.companyA.id, projectId: c.projectA.id, mode: "SIMULATED", dayOfWeek: 1, timezone: "America/Sao_Paulo", enabled: true });

    const modo = await request(app).put(`${base}/${ok.body.id}`).set(c.h.pentA).send({ mode: "REAL" });
    expect(modo.body.error).toBe("MODE_IS_IMMUTABLE");
    const desliga = await request(app).put(`${base}/${ok.body.id}`).set(c.h.pentA).send({ enabled: false, frequency: "DAILY" });
    expect(desliga.status).toBe(200);
    expect(desliga.body).toMatchObject({ enabled: false, frequency: "DAILY", dayOfWeek: null });
    expect((await request(app).delete(`${base}/${ok.body.id}`).set(c.h.pentA)).status).toBe(204);
    const acoes = (await prisma.auditLog.findMany({ where: { entityType: "ScanSchedule", entityId: ok.body.id } })).map((a) => a.action).sort();
    expect(acoes).toEqual(["CREATE", "DELETE", "UPDATE"]);
  });
});

describe("Agendamentos DAST — execução reconfere tudo", () => {
  it("SCHED-EXEC-01 — autorização vencida: não roda, motivo registrado, criador notificado", async () => {
    const c = await cenario();
    const sched = await autorizarEAgendar(c);
    await prisma.application.update({ where: { id: c.appA.id }, data: { dastAuthorizedUntil: new Date(Date.now() - 1000) } });

    await expect(makeDastScheduleService().executar(sched.id)).resolves.toBe("AUTHORIZATION_EXPIRED");
    expect(await prisma.dastScan.count()).toBe(0);
    expect((await prisma.scanSchedule.findUniqueOrThrow({ where: { id: sched.id } })).lastOutcome).toBe("AUTHORIZATION_EXPIRED");
    expect(await prisma.notification.count({ where: { userId: c.pentA.id, category: "DAST_SCHEDULE" } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { entityType: "ScanSchedule", entityId: sched.id, action: "EXECUTION" } })).toBe(1);
  });

  it("SCHED-EXEC-02 — host da aplicação diferente do autorizado: não roda", async () => {
    const c = await cenario();
    const sched = await autorizarEAgendar(c);
    await prisma.application.update({ where: { id: c.appA.id }, data: { url: "https://outro-host.example.com" } });
    await expect(makeDastScheduleService().executar(sched.id)).resolves.toBe("HOST_MISMATCH");
    expect(await prisma.dastScan.count()).toBe(0);
  });

  it("SCHED-EXEC-03 — REAL agendado que falha vira FAILED, nunca simulado, e notifica quem agendou", async () => {
    const c = await cenario();
    const sched = await autorizarEAgendar(c, { mode: "REAL" });
    await expect(makeDastScheduleService().executar(sched.id)).resolves.toBe("STARTED");

    const scan = await prisma.dastScan.findFirstOrThrow({ where: { scheduleId: sched.id } });
    expect(scan).toMatchObject({ trigger: "SCHEDULED", requestedById: c.pentA.id, companyId: c.companyA.id, applicationId: c.appA.id, projectId: c.projectA.id });
    const final = await esperarTerminal(scan.id);
    expect(final.status).toBe("FAILED");
    expect(final.simulated).toBe(false);
    expect(await prisma.dastFinding.count({ where: { scanId: scan.id } })).toBe(0);

    await esperar(() => prisma.notification.findFirst({ where: { userId: c.pentA.id, title: "Scan DAST agendado falhou" } }));
    expect((await prisma.scanSchedule.findUniqueOrThrow({ where: { id: sched.id } })).lastOutcome).toBe("SCAN_FAILED");
  });

  it("SCHED-EXEC-04 — simulado agendado roda, mas não entra nas métricas", async () => {
    const c = await cenario();
    const antes = await request(app).get(`/api/applications/${c.appA.id}/metrics/summary`).set(c.h.admin);
    expect(antes.status).toBe(200);

    const sched = await autorizarEAgendar(c);
    await expect(makeDastScheduleService().executar(sched.id)).resolves.toBe("STARTED");
    const scan = await prisma.dastScan.findFirstOrThrow({ where: { scheduleId: sched.id } });
    const final = await esperarTerminal(scan.id);
    expect(final).toMatchObject({ status: "COMPLETED", simulated: true });
    expect(await prisma.dastFinding.count({ where: { scanId: scan.id } })).toBeGreaterThan(0);

    const depois = await request(app).get(`/api/applications/${c.appA.id}/metrics/summary`).set(c.h.admin);
    expect(depois.body.totalFindings).toBe(antes.body.totalFindings);
    expect(depois.body.totalAbertos).toBe(antes.body.totalAbertos);
    expect(await prisma.vulnerability.count({ where: { applicationId: c.appA.id } })).toBe(0);
  });

  it("SCHED-EXEC-05 — criador que saiu do projeto: não roda (NOT_MEMBER); scan ativo no alvo: TARGET_BUSY", async () => {
    const c = await cenario();
    const sched = await autorizarEAgendar(c);
    await prisma.projectMember.deleteMany({ where: { projectId: c.projectA.id, userId: c.pentA.id } });
    await expect(makeDastScheduleService().executar(sched.id)).resolves.toBe("NOT_MEMBER");

    await seedProjectMember(c.projectA.id, c.pentA.id);
    await prisma.dastScan.create({ data: { targetUrl: "https://app-a.example.com/login", requestedById: c.admin.id, status: "RUNNING" } });
    await expect(makeDastScheduleService().executar(sched.id)).resolves.toBe("TARGET_BUSY");
    expect(await prisma.dastScan.count()).toBe(1);
  });
});

describe("Página /agendamentos — leitura global (SEC4)", () => {
  it("SCHED-PAG-01 — cada papel vê só o próprio recorte; a outra empresa nunca aparece", async () => {
    const c = await cenario();
    const sched = await autorizarEAgendar(c);
    // Um agendamento da empresa B, criado pelo ADMIN (sem projeto).
    await request(app).put(`/api/applications/${c.appB.id}/dast-authorization`).set(c.h.admin).send({ until: ate(30) });
    const deB = await request(app).post(`/api/applications/${c.appB.id}/dast-schedules`).set(c.h.admin).send(corpo());
    expect(deB.status).toBe(201);

    const ids = async (h: Record<string, string>) => {
      const r = await request(app).get("/api/dast-schedules").set(h);
      expect(r.status).toBe(200);
      return r.body;
    };
    const admin = await ids(c.h.admin);
    expect(admin.schedules.map((s: { id: string }) => s.id).sort()).toEqual([sched.id, deB.body.id].sort());
    expect(admin.canCreate).toBe(true);
    // Testes rodam com o motor memory: nada dispara sozinho, e a página precisa dizer isso.
    expect(admin.runsSchedules).toBe(false);

    const pentA = await ids(c.h.pentA);
    expect(pentA.schedules.map((s: { id: string }) => s.id)).toEqual([sched.id]);
    expect(pentA.schedules[0]).toMatchObject({
      application: { id: c.appA.id, name: "App A", companyName: "Empresa A", active: true },
      projectName: "Proj A",
      authorization: { host: "app-a.example.com", problem: null },
      nextRunAt: null,
      canEdit: true,
    });

    expect((await ids(c.h.pentOutro)).schedules).toEqual([]);

    const clientA = await ids(c.h.clientA);
    expect(clientA.schedules.map((s: { id: string }) => s.id)).toEqual([sched.id]);
    expect(clientA.canCreate).toBe(false);
    expect(clientA.schedules[0].canEdit).toBe(false);

    const clientB = await ids(c.h.clientB);
    expect(clientB.schedules.map((s: { id: string }) => s.id)).toEqual([deB.body.id]);
  });

  it("SCHED-PAG-02 — alvos: ADMIN vê todas as aplicações com URL; PENTESTER só as dele e só os projetos dele; CLIENT não agenda", async () => {
    const c = await cenario();
    await seedProject({ name: "Proj A2 (sem o pentester)", applicationId: c.appA.id, companyId: c.companyA.id });
    await seedApplication({ name: "Sem URL", companyId: c.companyA.id, url: null });

    const admin = await request(app).get("/api/dast-schedules/targets").set(c.h.admin);
    expect(admin.status).toBe(200);
    expect(admin.body.map((a: { name: string }) => a.name).sort()).toEqual(["App A", "App B"]);
    const appAAdmin = admin.body.find((a: { name: string }) => a.name === "App A");
    expect(appAAdmin.projects).toHaveLength(2);
    expect(appAAdmin.projectRequired).toBe(false);
    expect(appAAdmin.authorization).toMatchObject({ problem: "AUTHORIZATION_MISSING", currentHost: "app-a.example.com", canEdit: true });

    const pent = await request(app).get("/api/dast-schedules/targets").set(c.h.pentA);
    expect(pent.body.map((a: { name: string }) => a.name)).toEqual(["App A"]);
    expect(pent.body[0].projects).toEqual([{ id: c.projectA.id, name: "Proj A" }]);
    expect(pent.body[0].projectRequired).toBe(true);

    expect((await request(app).get("/api/dast-schedules/targets").set(c.h.pentOutro)).body).toEqual([]);
    expect((await request(app).get("/api/dast-schedules/targets").set(c.h.clientA)).status).toBe(403);
    expect((await request(app).get("/api/dast-schedules")).status).toBe(401);
  });
});

describe("Agendamento só por URL (decisão de 2026-11-19)", () => {
  const porUrl = (extra: Record<string, unknown> = {}) => ({
    targetUrl: "https://alvo-solto.example.com/login#x",
    confirmedAuthorization: true,
    ...corpo(extra),
  });

  it("SCHED-URL-01 — ADMIN/PENTESTER criam sem aplicação nem projeto; confirmação obrigatória; CLIENT não cria", async () => {
    const c = await cenario();
    const semConfirmar = await request(app).post("/api/dast-schedules").set(c.h.pentA).send(porUrl({ confirmedAuthorization: false }));
    expect(semConfirmar.status).toBe(400);
    expect(semConfirmar.body.error).toBe("AUTHORIZATION_CONFIRMATION_REQUIRED");
    expect((await request(app).post("/api/dast-schedules").set(c.h.pentA).send(porUrl({ targetUrl: "ftp://x" }))).body.error).toBe("INVALID_TARGET_URL");
    expect((await request(app).post("/api/dast-schedules").set(c.h.pentA).send(porUrl({ targetUrl: "" }))).body.error).toBe("MISSING_TARGET_URL");
    expect((await request(app).post("/api/dast-schedules").set(c.h.clientA).send(porUrl())).status).toBe(403);

    const res = await request(app).post("/api/dast-schedules").set(c.h.pentA).send(porUrl({ companyId: c.companyA.id, projectId: c.projectA.id }));
    expect(res.status).toBe(201);
    // Fragmento removido; empresa e projeto do corpo ignorados (SEC2).
    expect(res.body).toMatchObject({ targetUrl: "https://alvo-solto.example.com/login", applicationId: null, companyId: null, projectId: null });

    const audit = await prisma.auditLog.findFirst({ where: { entityType: "ScanSchedule", entityId: res.body.id, action: "CREATE" } });
    expect(JSON.parse(audit!.diffJson!)).toMatchObject({ confirmedAuthorization: true });
  });

  it("SCHED-URL-02 — todo PENTESTER vê e edita; CLIENT não vê nem edita; modo e alvo não mudam", async () => {
    const c = await cenario();
    const criado = (await request(app).post("/api/dast-schedules").set(c.h.pentA).send(porUrl())).body;

    const outro = await request(app).get("/api/dast-schedules").set(c.h.pentOutro);
    expect(outro.body.schedules).toHaveLength(1);
    expect(outro.body.schedules[0]).toMatchObject({ id: criado.id, kind: "URL", url: "https://alvo-solto.example.com/login", application: null, authorization: null, canEdit: true });

    const editado = await request(app).put(`/api/dast-schedules/${criado.id}`).set(c.h.pentOutro).send({ hour: 22, enabled: false });
    expect(editado.status).toBe(200);
    expect(editado.body).toMatchObject({ hour: 22, enabled: false });
    expect((await request(app).put(`/api/dast-schedules/${criado.id}`).set(c.h.pentOutro).send({ mode: "REAL" })).body.error).toBe("MODE_IS_IMMUTABLE");
    expect((await request(app).put(`/api/dast-schedules/${criado.id}`).set(c.h.pentOutro).send({ targetUrl: "https://outro.example.com/" })).body.error).toBe("TARGET_IS_IMMUTABLE");

    expect((await request(app).get("/api/dast-schedules").set(c.h.clientA)).body.schedules).toEqual([]);
    expect((await request(app).put(`/api/dast-schedules/${criado.id}`).set(c.h.clientA).send({ hour: 1 })).status).toBe(404);
    expect((await request(app).delete(`/api/dast-schedules/${criado.id}`).set(c.h.clientA)).status).toBe(404);

    expect((await request(app).delete(`/api/dast-schedules/${criado.id}`).set(c.h.pentOutro)).status).toBe(204);
    expect(await prisma.scanSchedule.count()).toBe(0);
  });

  it("SCHED-URL-03 — na execução vira scan sem aplicação nem empresa, que todo o time de PENTESTER enxerga", async () => {
    const c = await cenario();
    const criado = (await request(app).post("/api/dast-schedules").set(c.h.pentA).send(porUrl())).body;

    await expect(makeDastScheduleService().executar(criado.id)).resolves.toBe("STARTED");
    const sched = await prisma.scanSchedule.findUniqueOrThrow({ where: { id: criado.id } });
    const scan = await esperarTerminal(sched.lastScanId!);
    expect(scan).toMatchObject({ trigger: "SCHEDULED", scheduleId: criado.id, applicationId: null, companyId: null, requestedById: c.pentA.id, simulated: true });
    expect(scan.targetUrl).toBe("https://alvo-solto.example.com/login");

    const lista = await request(app).get("/api/dast/scans").set(c.h.pentOutro);
    expect(lista.body.map((s: { id: string }) => s.id)).toContain(scan.id);
    expect((await request(app).get(`/api/dast/scans/${scan.id}`).set(c.h.pentOutro)).status).toBe(200);
    expect((await request(app).get(`/api/dast/scans/${scan.id}/findings`).set(c.h.pentOutro)).status).toBe(200);
  });

  it("SCHED-URL-04 — quem agendou e deixou de ser ADMIN/PENTESTER: não roda (CREATOR_INACTIVE)", async () => {
    const c = await cenario();
    const criado = (await request(app).post("/api/dast-schedules").set(c.h.pentA).send(porUrl())).body;
    await prisma.user.update({ where: { id: c.pentA.id }, data: { role: "CLIENT" } });
    await expect(makeDastScheduleService().executar(criado.id)).resolves.toBe("CREATOR_INACTIVE");
    expect(await prisma.dastScan.count()).toBe(0);
  });
});

describe("Rodar agora (página /agendamentos)", () => {
  it("RUN-01 — mesma permissão de editar; roda pelo caminho do worker e devolve { outcome, scanId }", async () => {
    const c = await cenario();
    const sched = await autorizarEAgendar(c);
    const rota = `/api/dast-schedules/${sched.id}/run`;

    // Sem vínculo com a aplicação: 404; CLIENT da própria empresa: 403; outra empresa: 404.
    expect((await request(app).post(rota).set(c.h.pentOutro)).status).toBe(404);
    expect((await request(app).post(rota).set(c.h.clientA)).status).toBe(403);
    expect((await request(app).post(rota).set(c.h.clientB)).status).toBe(404);
    expect(await prisma.dastScan.count()).toBe(0);

    const ok = await request(app).post(rota).set(c.h.pentA);
    expect(ok.status).toBe(200);
    expect(ok.body).toEqual({ outcome: "STARTED", scanId: expect.any(String) });
    const scan = await esperarTerminal(ok.body.scanId);
    expect(scan).toMatchObject({ status: "COMPLETED", trigger: "SCHEDULED", scheduleId: sched.id, requestedById: c.pentA.id, applicationId: c.appA.id });
    expect((await prisma.scanSchedule.findUniqueOrThrow({ where: { id: sched.id } })).lastScanId).toBe(scan.id);

    // O ADMIN também pode; cada clique gera um AuditLog RUN_NOW com quem pediu.
    expect((await request(app).post(rota).set(c.h.admin)).status).toBe(200);
    const auditoria = await prisma.auditLog.findMany({ where: { entityType: "ScanSchedule", entityId: sched.id, action: "RUN_NOW" } });
    expect(auditoria).toHaveLength(2);
    expect(auditoria.map((a) => a.actorId)).toContain(c.pentA.id);
    expect(auditoria.map((a) => a.actorId)).toContain(c.admin.id);
  });

  it("RUN-02 — agendamento pausado devolve DISABLED, sem scan, e registra o desfecho", async () => {
    const c = await cenario();
    const sched = await autorizarEAgendar(c);
    await request(app).put(`/api/dast-schedules/${sched.id}`).set(c.h.pentA).send({ enabled: false });

    const res = await request(app).post(`/api/dast-schedules/${sched.id}/run`).set(c.h.pentA);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ outcome: "DISABLED", scanId: null });
    expect(await prisma.dastScan.count()).toBe(0);
    expect((await prisma.scanSchedule.findUniqueOrThrow({ where: { id: sched.id } })).lastOutcome).toBe("DISABLED");
  });

  it("RUN-03 — agendamento por URL: qualquer PENTESTER roda; CLIENT não vê nem roda; id inexistente é 404", async () => {
    const c = await cenario();
    const criado = (await request(app).post("/api/dast-schedules").set(c.h.pentA).send(corpo({ targetUrl: "https://alvo-solto.example.com/login", confirmedAuthorization: true }))).body;
    const rota = `/api/dast-schedules/${criado.id}/run`;

    expect((await request(app).post(rota).set(c.h.clientA)).status).toBe(404);
    const ok = await request(app).post(rota).set(c.h.pentOutro);
    expect(ok.status).toBe(200);
    expect(ok.body.outcome).toBe("STARTED");
    await esperarTerminal(ok.body.scanId);

    const inexistente = await request(app).post("/api/dast-schedules/nao-existe/run").set(c.h.admin);
    expect(inexistente.status).toBe(404);
    expect(inexistente.body.error).toBe("SCHEDULE_NOT_FOUND");
  });
});

describe("Histórico do agendamento e comparação com a execução anterior", () => {
  const T0 = Date.parse("2026-11-01T03:00:00Z");

  /** Scan de agendamento inserido direto no banco: a história é controlada pelo teste. */
  async function scanDoAgendamento(c: Awaited<ReturnType<typeof cenario>>, scheduleId: string, horas: number, extra: Record<string, unknown> = {}) {
    return prisma.dastScan.create({
      data: {
        targetUrl: "https://app-a.example.com/login",
        requestedById: c.pentA.id,
        trigger: "SCHEDULED",
        scheduleId,
        companyId: c.companyA.id,
        applicationId: c.appA.id,
        projectId: c.projectA.id,
        status: "COMPLETED",
        simulated: true,
        createdAt: new Date(T0 + horas * 3600_000),
        finishedAt: new Date(T0 + horas * 3600_000 + 60_000),
        ...extra,
      },
    });
  }

  it("HIST-01 — mais recentes primeiro, padrão 10, limit respeitado, teto 50 e entrada inválida é 400", async () => {
    const c = await cenario();
    const sched = await autorizarEAgendar(c);
    await prisma.dastScan.createMany({
      data: Array.from({ length: 55 }, (_, i) => ({
        targetUrl: "https://app-a.example.com/login",
        requestedById: c.pentA.id,
        trigger: "SCHEDULED" as const,
        scheduleId: sched.id,
        companyId: c.companyA.id,
        applicationId: c.appA.id,
        projectId: c.projectA.id,
        status: "COMPLETED" as const,
        simulated: true,
        createdAt: new Date(T0 + i * 3600_000),
        alertsHigh: i,
      })),
    });
    const rota = `/api/dast-schedules/${sched.id}/history`;

    const padrao = await request(app).get(rota).set(c.h.admin);
    expect(padrao.status).toBe(200);
    expect(padrao.body).toHaveLength(10);
    expect(padrao.body[0]).toMatchObject({ status: "COMPLETED", simulated: true, alertsHigh: 54, alertsMedium: 0, alertsLow: 0, alertsInfo: 0 });
    expect(padrao.body.map((e: { alertsHigh: number }) => e.alertsHigh)).toEqual([54, 53, 52, 51, 50, 49, 48, 47, 46, 45]);

    expect((await request(app).get(`${rota}?limit=3`).set(c.h.admin)).body).toHaveLength(3);
    expect((await request(app).get(`${rota}?limit=500`).set(c.h.admin)).body).toHaveLength(50);
    expect((await request(app).get(`${rota}?limit=0`).set(c.h.admin)).body.error).toBe("INVALID_LIMIT");
    expect((await request(app).get(`${rota}?limit=abc`).set(c.h.admin)).status).toBe(400);
  });

  it("HIST-02 — tenancy: empresa B não lê o histórico da A; CLIENT da A lê o da aplicação; agendamento por URL é do time", async () => {
    const c = await cenario();
    const sched = await autorizarEAgendar(c);
    await scanDoAgendamento(c, sched.id, 0);
    const rota = `/api/dast-schedules/${sched.id}/history`;

    expect((await request(app).get(rota).set(c.h.clientB)).status).toBe(404);
    expect((await request(app).get(rota).set(c.h.pentOutro)).status).toBe(404);
    expect((await request(app).get(rota).set(c.h.clientA)).status).toBe(200);
    expect((await request(app).get(rota).set(c.h.pentA)).status).toBe(200);
    expect((await request(app).get(rota).set(c.h.admin)).status).toBe(200);

    const porUrl = (await request(app).post("/api/dast-schedules").set(c.h.pentA).send(corpo({ targetUrl: "https://alvo-solto.example.com/", confirmedAuthorization: true }))).body;
    expect((await request(app).get(`/api/dast-schedules/${porUrl.id}/history`).set(c.h.pentOutro)).status).toBe(200);
    expect((await request(app).get(`/api/dast-schedules/${porUrl.id}/history`).set(c.h.clientA)).status).toBe(404);
  });

  it("DIFF-01 — novos, resolvidos e persistentes por fingerprint, contra a COMPLETED anterior (também fora da janela)", async () => {
    const c = await cenario();
    const sched = await autorizarEAgendar(c);
    const antigo = await scanDoAgendamento(c, sched.id, 0);
    // FAILED entre os dois: não tem diff e não é base de comparação.
    const falhou = await scanDoAgendamento(c, sched.id, 24, { status: "FAILED", simulated: false, errorMessage: "ZAP caiu" });
    const novo = await scanDoAgendamento(c, sched.id, 48, { alertsMedium: 3 });

    const achado = (scanId: string, fingerprint: string) => ({
      scanId,
      fingerprint,
      pluginId: "10021",
      title: `Achado ${fingerprint}`,
      risk: "MEDIUM" as const,
      confidence: "Medium",
      url: "https://app-a.example.com/login",
      normalizedUrl: "https://app-a.example.com/login",
    });
    // Antigo: A, B, C. Novo: B, C, D, E → novos 2 (D, E), resolvidos 1 (A), persistentes 2 (B, C).
    await prisma.dastFinding.createMany({
      data: [...["fp-a", "fp-b", "fp-c"].map((f) => achado(antigo.id, f)), ...["fp-b", "fp-c", "fp-d", "fp-e"].map((f) => achado(novo.id, f))],
    });

    const rota = `/api/dast-schedules/${sched.id}/history`;
    const todo = (await request(app).get(rota).set(c.h.admin)).body;
    expect(todo.map((e: { id: string }) => e.id)).toEqual([novo.id, falhou.id, antigo.id]);
    expect(todo[0]).toMatchObject({ id: novo.id, alertsMedium: 3, diff: { novos: 2, resolvidos: 1, persistentes: 2 } });
    expect(todo[1]).toMatchObject({ id: falhou.id, status: "FAILED", diff: null });
    expect(todo[2]).toMatchObject({ id: antigo.id, diff: null });

    // Janela de 1: a base do item mostrado está fora dela e ainda assim é usada.
    const janela = (await request(app).get(`${rota}?limit=1`).set(c.h.admin)).body;
    expect(janela).toHaveLength(1);
    expect(janela[0].diff).toEqual({ novos: 2, resolvidos: 1, persistentes: 2 });
  });
});
