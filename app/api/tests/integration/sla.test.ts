/**
 * sla.test.ts (integration)
 *
 * SLA Engine (CP-2 — Exposure & Remediation). O que se prova aqui, contra o
 * banco e a API reais:
 *
 *   SLA-01  criar finding grava o ciclo pela política vigente (fallback do produto)
 *   SLA-02  política do tenant vence a padrão; PUT versiona (desativa a anterior)
 *   SLA-03  PUT NÃO recalcula findings existentes (prazo congelado)
 *   SLA-04  POST /apply recalcula só OPEN/IN_PROGRESS mantendo slaStartedAt; audita
 *   SLA-05  mudar o vetor CVSS (severidade) recalcula mantendo o início; audita
 *   SLA-06  override de severidade idem
 *   SLA-07  ?slaState= filtra; os DOIS construtores concordam (sortBy=severity × createdAt)
 *   SLA-08  FIXED → IN_PROGRESS abre novo ciclo; IN_PROGRESS → OPEN não mexe
 *   SLA-09  CLOSED é terminal; transição fora da whitelist → 400
 *   SLA-10  DTO: estado derivado, RESOLVED_IN_SLA/LATE pelo AuditLog, sortBy=slaDueAt
 *   SLA-11  RBAC da política: OWNER define, MEMBER não, PENTESTER não, /apply só ADMIN
 *   SLA-12  backfill: só ativos, idempotente, FIXED/CLOSED intocados
 *   SLA-13  validação: dias fora de 1..365 → 400; slaState inválido → 400
 *   TEN-30  CLIENT OWNER de B não lê nem define política de A
 */

import request from "supertest";
import { app } from "../../src/app";
import { cleanDatabase } from "../setup";
import { prisma } from "../../src/database/prisma.database";
import { seedUser } from "../fixtures/users.fixture";
import { seedPlan } from "../fixtures/plans.fixture";
import { seedCompany } from "../fixtures/companies.fixture";
import { seedSubscription } from "../fixtures/subscriptions.fixture";
import { seedApplication } from "../fixtures/applications.fixture";
import { seedProject, seedProjectMember } from "../fixtures/projects.fixture";
import { seedVulnerability } from "../fixtures/vulnerabilities.fixture";
import { loginAs } from "../fixtures/auth.fixture";
import { DIA_MS } from "../../src/utils/sla.util";

const PASSWORD = "senha12345";
const VETOR_CRITICO = "AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H"; // 9.8 CRITICAL
const VETOR_MEDIO = "AV:N/AC:L/PR:L/UI:N/S:U/C:L/I:L/A:N"; // 5.4 MEDIUM

type Cenario = {
  admin: string;
  ownerA: string;
  memberA: string;
  ownerB: string;
  pentester: string;
  pentesterId: string;
  companyAId: string;
  companyBId: string;
  appAId: string;
  projectAId: string;
};

async function montarCenario(): Promise<Cenario> {
  const plan = await seedPlan({ name: "PRO" });
  const companyA = await seedCompany({ name: "Empresa A", planId: plan.id });
  const companyB = await seedCompany({ name: "Empresa B", planId: plan.id });
  for (const c of [companyA, companyB]) {
    await seedSubscription({ companyId: c.id, planId: plan.id, status: "ACTIVE", startDate: new Date() });
  }
  const admin = await seedUser({ name: "Admin", email: "admin@v.local", password: PASSWORD, role: "ADMIN" });
  const ownerA = await seedUser({
    name: "Owner A",
    email: "owner-a@v.local",
    password: PASSWORD,
    role: "CLIENT",
    companyId: companyA.id,
    companyRole: "OWNER",
  });
  const memberA = await seedUser({
    name: "Member A",
    email: "member-a@v.local",
    password: PASSWORD,
    role: "CLIENT",
    companyId: companyA.id,
    companyRole: "MEMBER",
  });
  const ownerB = await seedUser({
    name: "Owner B",
    email: "owner-b@v.local",
    password: PASSWORD,
    role: "CLIENT",
    companyId: companyB.id,
    companyRole: "OWNER",
  });
  const pentester = await seedUser({ name: "Pen", email: "pen@v.local", password: PASSWORD, role: "PENTESTER" });
  const appA = await seedApplication({ name: "App A", companyId: companyA.id });
  const projectA = await seedProject({ name: "Proj A", applicationId: appA.id, companyId: companyA.id });
  await seedProjectMember(projectA.id, pentester.id);

  // política padrão do produto (o seed real também a cria)
  await prisma.slaPolicy.create({
    data: { companyId: null, name: "Padrão", criticalDays: 2, highDays: 7, mediumDays: 30, lowDays: 90, createdBy: "system" },
  });

  return {
    admin: await loginAs(app, admin.email, PASSWORD),
    ownerA: await loginAs(app, ownerA.email, PASSWORD),
    memberA: await loginAs(app, memberA.email, PASSWORD),
    ownerB: await loginAs(app, ownerB.email, PASSWORD),
    pentester: await loginAs(app, pentester.email, PASSWORD),
    pentesterId: pentester.id,
    companyAId: companyA.id,
    companyBId: companyB.id,
    appAId: appA.id,
    projectAId: projectA.id,
  };
}

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
const criarFinding = (c: Cenario, token: string, cvssVector = VETOR_CRITICO, title = "SQLi") =>
  request(app)
    .post("/api/vulnerabilities")
    .set(auth(token))
    .send({ projectId: c.projectAId, title, description: "desc", owaspCategory: "A03", cvssVector });
const putPolitica = (c: Cenario, token: string, companyId: string, body: object) =>
  request(app).put(`/api/companies/${companyId}/sla-policy`).set(auth(token)).send(body);
const transicionar = (token: string, id: string, toStatus: string) =>
  request(app).post(`/api/vulnerabilities/${id}/transition`).set(auth(token)).send({ toStatus });
const listar = (token: string, qs = "") => request(app).get(`/api/vulnerabilities${qs}`).set(auth(token));

describe("SLA Engine (CP-2)", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it("SLA-01: criar finding grava slaStartedAt=createdAt e dueAt pela política padrão (CRITICAL = 2 dias)", async () => {
    const c = await montarCenario();
    const res = await criarFinding(c, c.pentester);
    expect(res.status).toBe(201);
    expect(res.body.sla.state).toBe("ON_TRACK");
    const v = await prisma.vulnerability.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(v.slaStartedAt!.getTime()).toBe(v.createdAt.getTime());
    expect(v.slaDueAt!.getTime() - v.slaStartedAt!.getTime()).toBe(2 * DIA_MS);
    expect(v.slaDueSoonAt!.getTime() - v.slaStartedAt!.getTime()).toBeCloseTo(1.6 * DIA_MS, -3);
    const padrao = await prisma.slaPolicy.findFirstOrThrow({ where: { companyId: null } });
    expect(v.slaPolicyId).toBe(padrao.id);
    expect(res.body.sla.dueAt).toBe(v.slaDueAt!.toISOString());
  });

  it("SLA-02: política do tenant vence a padrão; PUT versiona e a anterior fica inativa", async () => {
    const c = await montarCenario();
    const p1 = await putPolitica(c, c.ownerA, c.companyAId, { criticalDays: 1, highDays: 3, mediumDays: 10, lowDays: 20 });
    expect(p1.status).toBe(200);
    expect(p1.body.isDefault).toBe(false);

    const res = await criarFinding(c, c.pentester);
    const v = await prisma.vulnerability.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(v.slaDueAt!.getTime() - v.slaStartedAt!.getTime()).toBe(1 * DIA_MS);
    expect(v.slaPolicyId).toBe(p1.body.id);

    const p2 = await putPolitica(c, c.ownerA, c.companyAId, { criticalDays: 5, highDays: 3, mediumDays: 10, lowDays: 20 });
    expect(p2.status).toBe(200);
    const versoes = await prisma.slaPolicy.findMany({ where: { companyId: c.companyAId } });
    expect(versoes).toHaveLength(2);
    expect(versoes.filter((p) => p.isActive)).toHaveLength(1);
    expect(versoes.find((p) => p.isActive)!.id).toBe(p2.body.id);

    const hist = await request(app).get(`/api/companies/${c.companyAId}/sla-policy/history`).set(auth(c.ownerA));
    expect(hist.body).toHaveLength(2);
    const audit = await prisma.auditLog.findMany({ where: { entityType: "SlaPolicy" } });
    expect(audit.map((a) => a.action).sort()).toEqual(["CREATE", "UPDATE"]);
  });

  it("SLA-03: mudar a política NÃO reescreve o prazo de quem já tem (consistência histórica)", async () => {
    const c = await montarCenario();
    const res = await criarFinding(c, c.pentester);
    const antes = await prisma.vulnerability.findUniqueOrThrow({ where: { id: res.body.id } });
    await putPolitica(c, c.admin, c.companyAId, { criticalDays: 30, highDays: 30, mediumDays: 30, lowDays: 30 });
    const depois = await prisma.vulnerability.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(depois.slaDueAt!.getTime()).toBe(antes.slaDueAt!.getTime());
    expect(depois.slaPolicyId).toBe(antes.slaPolicyId);
  });

  it("SLA-04: POST /apply recalcula só os ativos, mantém slaStartedAt, dá SLA a quem não tinha, audita", async () => {
    const c = await montarCenario();
    const aberto = await criarFinding(c, c.pentester);
    const fechado = await criarFinding(c, c.pentester, VETOR_CRITICO, "fechado");
    await transicionar(c.pentester, fechado.body.id, "IN_PROGRESS");
    await transicionar(c.pentester, fechado.body.id, "FIXED");
    const semSla = await seedVulnerability({
      projectId: c.projectAId,
      applicationId: c.appAId,
      companyId: c.companyAId,
      createdBy: c.pentesterId,
      severityFinal: "HIGH",
      createdAt: new Date(Date.now() - 10 * DIA_MS),
    });
    const abertoAntes = await prisma.vulnerability.findUniqueOrThrow({ where: { id: aberto.body.id } });
    const fechadoAntes = await prisma.vulnerability.findUniqueOrThrow({ where: { id: fechado.body.id } });

    await putPolitica(c, c.admin, c.companyAId, { criticalDays: 10, highDays: 3, mediumDays: 30, lowDays: 90 });
    const apply = await request(app).post(`/api/companies/${c.companyAId}/sla-policy/apply`).set(auth(c.admin));
    expect(apply.status).toBe(200);
    expect(apply.body.recalculated).toBe(2); // o aberto e o sem-SLA; o FIXED não

    const abertoDepois = await prisma.vulnerability.findUniqueOrThrow({ where: { id: aberto.body.id } });
    expect(abertoDepois.slaStartedAt!.getTime()).toBe(abertoAntes.slaStartedAt!.getTime());
    expect(abertoDepois.slaDueAt!.getTime() - abertoDepois.slaStartedAt!.getTime()).toBe(10 * DIA_MS);

    const fechadoDepois = await prisma.vulnerability.findUniqueOrThrow({ where: { id: fechado.body.id } });
    expect(fechadoDepois.slaDueAt!.getTime()).toBe(fechadoAntes.slaDueAt!.getTime());

    const semSlaDepois = await prisma.vulnerability.findUniqueOrThrow({ where: { id: semSla.id } });
    expect(semSlaDepois.slaStartedAt!.getTime()).toBe(semSla.createdAt.getTime()); // contado do createdAt
    expect(semSlaDepois.slaDueAt!.getTime() - semSla.createdAt.getTime()).toBe(3 * DIA_MS); // HIGH = 3 → já vencido

    const audit = await prisma.auditLog.findFirst({ where: { action: "SLA_POLICY_APPLIED" } });
    expect(audit).not.toBeNull();
    expect(JSON.parse(audit!.diffJson!).recalculated).toBe(2);
  });

  it("SLA-05: editar o vetor CVSS (MEDIUM→CRITICAL) recalcula o prazo mantendo o início — e pode estourar na hora", async () => {
    const c = await montarCenario();
    const antigo = await seedVulnerability({
      projectId: c.projectAId,
      applicationId: c.appAId,
      companyId: c.companyAId,
      createdBy: c.pentesterId,
      cvssVector: VETOR_MEDIO,
      cvssScore: 5.4,
      severityCalculated: "MEDIUM",
      createdAt: new Date(Date.now() - 10 * DIA_MS),
    });
    await request(app).post(`/api/companies/${c.companyAId}/sla-policy/apply`).set(auth(c.admin));
    let v = await prisma.vulnerability.findUniqueOrThrow({ where: { id: antigo.id } });
    expect(v.slaDueAt!.getTime() - v.slaStartedAt!.getTime()).toBe(30 * DIA_MS); // MEDIUM

    const res = await request(app)
      .put(`/api/vulnerabilities/${antigo.id}`)
      .set(auth(c.pentester))
      .send({ cvssVector: VETOR_CRITICO });
    expect(res.status).toBe(200);
    expect(res.body.severityFinal).toBe("CRITICAL");
    expect(res.body.sla.state).toBe("BREACHED"); // 2 dias, conhecido há 10

    v = await prisma.vulnerability.findUniqueOrThrow({ where: { id: antigo.id } });
    expect(v.slaStartedAt!.getTime()).toBe(antigo.createdAt.getTime());
    expect(v.slaDueAt!.getTime() - v.slaStartedAt!.getTime()).toBe(2 * DIA_MS);
    const audit = await prisma.auditLog.findFirst({ where: { entityId: antigo.id, action: "SLA_RECALCULATED" } });
    expect(JSON.parse(audit!.diffJson!).severity).toEqual({ from: "MEDIUM", to: "CRITICAL" });
  });

  it("SLA-06: override de severidade também recalcula (lê severityFinal)", async () => {
    const c = await montarCenario();
    const res = await criarFinding(c, c.pentester); // CRITICAL, 2 dias
    const over = await request(app)
      .post(`/api/vulnerabilities/${res.body.id}/override-severity`)
      .set(auth(c.pentester))
      .send({ newSeverity: "LOW", justification: "Ambiente isolado, sem exposição real." });
    expect(over.status).toBe(200);
    const v = await prisma.vulnerability.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(v.slaDueAt!.getTime() - v.slaStartedAt!.getTime()).toBe(90 * DIA_MS);
    expect(await prisma.auditLog.count({ where: { entityId: res.body.id, action: "SLA_RECALCULATED" } })).toBe(1);
  });

  it("SLA-07: ?slaState= filtra pelos estados ativos e os DOIS construtores concordam", async () => {
    const c = await montarCenario();
    const mk = (title: string, diasAtras: number, severity: string, status = "OPEN") =>
      seedVulnerability({
        projectId: c.projectAId,
        applicationId: c.appAId,
        companyId: c.companyAId,
        createdBy: c.pentesterId,
        title,
        severityFinal: severity,
        severityCalculated: severity,
        status,
        createdAt: new Date(Date.now() - diasAtras * DIA_MS),
      });
    await mk("vencido", 10, "CRITICAL"); // 2 dias → BREACHED
    await mk("em breve", 6, "HIGH"); // 7 dias, restam 1 (< 1,4 = 20%) → DUE_SOON
    await mk("no prazo", 1, "MEDIUM"); // 30 dias → ON_TRACK
    await mk("sem sla", 1, "NONE"); // NO_SLA
    // "resolvido" nasce ABERTO, ganha SLA no /apply e só então é corrigido —
    // um FIXED que nunca teve prazo seria NO_SLA (dueAt IS NULL), não RESOLVED.
    const resolvido = await mk("resolvido", 1, "LOW");
    await request(app).post(`/api/companies/${c.companyAId}/sla-policy/apply`).set(auth(c.admin));
    await transicionar(c.pentester, resolvido.id, "IN_PROGRESS");
    await transicionar(c.pentester, resolvido.id, "FIXED");

    const titulos = async (qs: string) => (await listar(c.admin, qs)).body.data.map((f: { title: string }) => f.title).sort();
    expect(await titulos("?slaState=BREACHED")).toEqual(["vencido"]);
    expect(await titulos("?slaState=DUE_SOON")).toEqual(["em breve"]);
    expect(await titulos("?slaState=ON_TRACK")).toEqual(["no prazo"]);
    expect(await titulos("?slaState=NO_SLA")).toEqual(["sem sla"]);
    expect(await titulos("?slaState=RESOLVED")).toEqual(["resolvido"]);
    expect(await titulos("?slaState=BREACHED,DUE_SOON")).toEqual(["em breve", "vencido"]);

    // os gêmeos: sortBy=severity passa pelo SQL cru; createdAt pelo Prisma
    for (const filtro of ["BREACHED", "DUE_SOON", "ON_TRACK", "NO_SLA", "RESOLVED", "BREACHED,ON_TRACK,NO_SLA"]) {
      const sql = await listar(c.admin, `?slaState=${filtro}&sortBy=severity`);
      const prismaQ = await listar(c.admin, `?slaState=${filtro}&sortBy=createdAt`);
      expect(sql.status).toBe(200);
      expect(sql.body.data.map((f: { id: string }) => f.id).sort()).toEqual(
        prismaQ.body.data.map((f: { id: string }) => f.id).sort(),
      );
      expect(sql.body.pagination.total).toBe(prismaQ.body.pagination.total);
    }
    // combinado com busca textual (o OR do `search` e o AND do SLA convivem)
    expect(await titulos("?slaState=BREACHED,ON_TRACK&search=prazo")).toEqual(["no prazo"]);
  });

  it("SLA-08: FIXED→IN_PROGRESS abre NOVO ciclo (início = agora, pausa zerada); IN_PROGRESS→OPEN não mexe", async () => {
    const c = await montarCenario();
    const antigo = await seedVulnerability({
      projectId: c.projectAId,
      applicationId: c.appAId,
      companyId: c.companyAId,
      createdBy: c.pentesterId,
      createdAt: new Date(Date.now() - 10 * DIA_MS),
    });
    await request(app).post(`/api/companies/${c.companyAId}/sla-policy/apply`).set(auth(c.admin));
    await prisma.vulnerability.update({ where: { id: antigo.id }, data: { slaPausedMs: 3 * DIA_MS } });
    const cicloAntigo = await prisma.vulnerability.findUniqueOrThrow({ where: { id: antigo.id } });

    expect((await transicionar(c.pentester, antigo.id, "IN_PROGRESS")).status).toBe(200);
    // IN_PROGRESS → OPEN: relógio intacto
    expect((await transicionar(c.pentester, antigo.id, "OPEN")).status).toBe(200);
    let v = await prisma.vulnerability.findUniqueOrThrow({ where: { id: antigo.id } });
    expect(v.slaStartedAt!.getTime()).toBe(cicloAntigo.slaStartedAt!.getTime());
    expect(v.slaPausedMs).toBe(3 * DIA_MS);

    await transicionar(c.pentester, antigo.id, "IN_PROGRESS");
    await transicionar(c.pentester, antigo.id, "FIXED");
    const antesDeReabrir = Date.now();
    const reab = await transicionar(c.pentester, antigo.id, "IN_PROGRESS");
    expect(reab.status).toBe(200);
    expect(reab.body.sla.state).toBe("ON_TRACK");
    v = await prisma.vulnerability.findUniqueOrThrow({ where: { id: antigo.id } });
    expect(v.slaStartedAt!.getTime()).toBeGreaterThanOrEqual(antesDeReabrir - 1000);
    expect(v.slaPausedMs).toBe(0);
    expect(v.slaDueAt!.getTime() - v.slaStartedAt!.getTime()).toBe(2 * DIA_MS);

    const trilha = await prisma.auditLog.findMany({ where: { entityId: antigo.id, action: "STATUS_CHANGE" } });
    const reabertura = trilha.map((a) => JSON.parse(a.diffJson!)).find((d) => d.slaNewCycle);
    expect(reabertura.from).toBe("FIXED");
    expect(new Date(reabertura.previousSla.startedAt).getTime()).toBe(cicloAntigo.slaStartedAt!.getTime());
    expect(reabertura.previousSla.pausedMs).toBe(3 * DIA_MS);
  });

  it("SLA-09: CLOSED é terminal e transições fora da whitelist são recusadas (ADR-033)", async () => {
    const c = await montarCenario();
    const res = await criarFinding(c, c.pentester);
    const id = res.body.id;
    expect((await transicionar(c.pentester, id, "FIXED")).status).toBe(400); // OPEN → FIXED não existe
    expect((await transicionar(c.pentester, id, "CLOSED")).status).toBe(400);
    await transicionar(c.pentester, id, "IN_PROGRESS");
    await transicionar(c.pentester, id, "FIXED");
    await transicionar(c.pentester, id, "CLOSED");
    for (const destino of ["OPEN", "IN_PROGRESS", "FIXED"]) {
      const r = await transicionar(c.pentester, id, destino);
      expect(r.status).toBe(400);
      expect(r.body.error).toBe("INVALID_STATUS_TRANSITION");
    }
  });

  it("SLA-10: DTO deriva o estado; RESOLVED_IN_SLA/LATE saem do AuditLog; sortBy=slaDueAt ordena no banco", async () => {
    const c = await montarCenario();
    const noPrazo = await criarFinding(c, c.pentester, VETOR_CRITICO, "a tempo");
    await transicionar(c.pentester, noPrazo.body.id, "IN_PROGRESS");
    await transicionar(c.pentester, noPrazo.body.id, "FIXED");
    const atrasado = await seedVulnerability({
      projectId: c.projectAId,
      applicationId: c.appAId,
      companyId: c.companyAId,
      createdBy: c.pentesterId,
      title: "atrasado",
      createdAt: new Date(Date.now() - 10 * DIA_MS),
    });
    await request(app).post(`/api/companies/${c.companyAId}/sla-policy/apply`).set(auth(c.admin));
    await transicionar(c.pentester, atrasado.id, "IN_PROGRESS");
    await transicionar(c.pentester, atrasado.id, "FIXED"); // hoje, 8 dias depois de vencer

    const d1 = await request(app).get(`/api/vulnerabilities/${noPrazo.body.id}`).set(auth(c.ownerA));
    expect(d1.body.sla.state).toBe("RESOLVED_IN_SLA");
    const d2 = await request(app).get(`/api/vulnerabilities/${atrasado.id}`).set(auth(c.ownerA));
    expect(d2.body.sla.state).toBe("RESOLVED_LATE");
    expect(d2.body.sla.remainingMs).toBeLessThan(0);

    const lista = await listar(c.admin, "?sortBy=slaDueAt&sortOrder=asc");
    expect(lista.status).toBe(200);
    expect(lista.body.data.map((f: { title: string }) => f.title)).toEqual(["atrasado", "a tempo"]);
    expect(lista.body.data[0].slaState).toBe("RESOLVED_LATE");
    expect(lista.body.data[1].slaState).toBe("RESOLVED_IN_SLA");
  });

  it("SLA-11: RBAC — OWNER define a própria; MEMBER e PENTESTER não; /apply é só ADMIN; GET é ADMIN ou CLIENT da empresa", async () => {
    const c = await montarCenario();
    const body = { criticalDays: 1, highDays: 2, mediumDays: 3, lowDays: 4 };
    expect((await putPolitica(c, c.ownerA, c.companyAId, body)).status).toBe(200);
    expect((await putPolitica(c, c.memberA, c.companyAId, body)).status).toBe(403);
    expect((await putPolitica(c, c.pentester, c.companyAId, body)).status).toBe(403);
    expect((await request(app).post(`/api/companies/${c.companyAId}/sla-policy/apply`).set(auth(c.ownerA))).status).toBe(403);
    expect((await request(app).get(`/api/companies/${c.companyAId}/sla-policy`).set(auth(c.memberA))).status).toBe(200);
    expect((await request(app).get(`/api/companies/${c.companyAId}/sla-policy`).set(auth(c.pentester))).status).toBe(403);
    // sem política própria, o GET devolve a padrão marcada como tal
    const b = await request(app).get(`/api/companies/${c.companyBId}/sla-policy`).set(auth(c.ownerB));
    expect(b.status).toBe(200);
    expect(b.body.isDefault).toBe(true);
    expect(b.body.criticalDays).toBe(2);
  });

  it("SLA-12: backfill (D1) só toca ativos sem SLA, contado do createdAt, e é idempotente", async () => {
    const c = await montarCenario();
    const mk = (title: string, status: string, diasAtras: number) =>
      seedVulnerability({
        projectId: c.projectAId,
        applicationId: c.appAId,
        companyId: c.companyAId,
        createdBy: c.pentesterId,
        title,
        status,
        createdAt: new Date(Date.now() - diasAtras * DIA_MS),
      });
    const aberto = await mk("aberto", "OPEN", 5);
    const emAndamento = await mk("andamento", "IN_PROGRESS", 1);
    const corrigido = await mk("corrigido", "FIXED", 5);
    const fechado = await mk("fechado", "CLOSED", 5);

    // o backfill é um script; aqui exercitamos a mesma regra pelo endpoint
    // administrativo, que compartilha o critério (só OPEN/IN_PROGRESS, início = createdAt)
    const r1 = await request(app).post(`/api/companies/${c.companyAId}/sla-policy/apply`).set(auth(c.admin));
    expect(r1.body.recalculated).toBe(2);
    for (const [v, esperaSla] of [
      [aberto, true],
      [emAndamento, true],
      [corrigido, false],
      [fechado, false],
    ] as const) {
      const atual = await prisma.vulnerability.findUniqueOrThrow({ where: { id: v.id } });
      if (esperaSla) {
        expect(atual.slaStartedAt!.getTime()).toBe(v.createdAt.getTime());
        expect(atual.slaDueAt).not.toBeNull();
      } else {
        expect(atual.slaDueAt).toBeNull();
      }
    }
    // idempotente: segunda passada não muda nada
    const antes = await prisma.vulnerability.findUniqueOrThrow({ where: { id: aberto.id } });
    await request(app).post(`/api/companies/${c.companyAId}/sla-policy/apply`).set(auth(c.admin));
    const depois = await prisma.vulnerability.findUniqueOrThrow({ where: { id: aberto.id } });
    expect(depois.slaDueAt!.getTime()).toBe(antes.slaDueAt!.getTime());
    expect(depois.slaStartedAt!.getTime()).toBe(antes.slaStartedAt!.getTime());
  });

  it("SLA-13: validação — dias fora de 1..365 ou não-inteiros → 400; slaState desconhecido → 400", async () => {
    const c = await montarCenario();
    for (const body of [
      { criticalDays: 0, highDays: 7, mediumDays: 30, lowDays: 90 },
      { criticalDays: 2, highDays: 366, mediumDays: 30, lowDays: 90 },
      { criticalDays: 2.5, highDays: 7, mediumDays: 30, lowDays: 90 },
      { criticalDays: "2", highDays: 7, mediumDays: 30, lowDays: 90 },
      { criticalDays: 2, highDays: 7, mediumDays: 30 },
    ]) {
      const r = await putPolitica(c, c.admin, c.companyAId, body);
      expect(r.status).toBe(400);
      expect(r.body.error).toBe("INVALID_SLA_DAYS");
    }
    const r = await listar(c.admin, "?slaState=VENCIDO");
    expect(r.status).toBe(400);
    expect(r.body.error).toBe("INVALID_SLA_STATE");
  });

  it("TEN-30: CLIENT OWNER de B não lê, não define nem reaplica política de A → 403", async () => {
    const c = await montarCenario();
    expect((await request(app).get(`/api/companies/${c.companyAId}/sla-policy`).set(auth(c.ownerB))).status).toBe(403);
    expect(
      (await putPolitica(c, c.ownerB, c.companyAId, { criticalDays: 1, highDays: 1, mediumDays: 1, lowDays: 1 })).status,
    ).toBe(403);
    expect((await request(app).post(`/api/companies/${c.companyAId}/sla-policy/apply`).set(auth(c.ownerB))).status).toBe(403);
    expect(await prisma.slaPolicy.count({ where: { companyId: c.companyAId } })).toBe(0);
  });
});
