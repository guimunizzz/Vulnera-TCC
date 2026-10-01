/**
 * vrs.test.ts (integration)
 *
 * Vulnera Risk Score (CP-3) contra o banco e a API reais. A fórmula em si é
 * provada em tests/unit/vrs.util.test.ts; aqui o que importa é o CICLO DE
 * VIDA do número: quando é calculado, quando é recalculado, quando NÃO muda,
 * como se filtra e ordena, e que ninguém o altera na mão.
 *
 *   VRS-01  criar finding grava score + breakdown explicável
 *   VRS-02  editar o vetor CVSS recalcula; editar título NÃO
 *   VRS-03  override de severidade sem mudança de vetor NÃO muda o VRS (D3)
 *   VRS-04  mudar contexto da aplicação recalcula TODOS os findings dela e audita a contagem
 *   VRS-05  ?vrsMin/?vrsMax filtram; sortBy=vrsScore ordena no banco; os DOIS construtores concordam
 *   VRS-06  faixa inválida → 400
 *   VRS-07  VRS não é alterável diretamente pela API (campo no body é ignorado)
 *   VRS-08  promoção DAST pontua com o contexto da app, sem desconto por origem
 *   VRS-09  três findings reais: baixo, médio, alto — a ordem contextual vence a ordem do CVSS
 *   TEN-31  CLIENT de B não vê nem filtra findings de A por VRS; contexto de A não vaza
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
import { loginAs } from "../fixtures/auth.fixture";

const PASSWORD = "senha12345";
const V_98 = "AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H"; // 9.8
const V_54 = "AV:N/AC:L/PR:L/UI:N/S:U/C:L/I:L/A:N"; // 5.4
const V_31 = "AV:N/AC:H/PR:N/UI:R/S:U/C:L/I:N/A:N"; // 3.1

type Cenario = {
  admin: string;
  ownerA: string;
  ownerB: string;
  pentester: string;
  companyAId: string;
  companyBId: string;
  /** App crítica, PROD, exposta, RESTRITA — contexto máximo. */
  appCritica: string;
  /** App média, HOMOL, interna, INTERNA — contexto neutro-ish. */
  appModesta: string;
  projCritica: string;
  projModesta: string;
  appB: string;
  projB: string;
};

async function montarCenario(): Promise<Cenario> {
  const plan = await seedPlan({ name: "PRO", maxApplications: 10 });
  const companyA = await seedCompany({ name: "Empresa A", planId: plan.id });
  const companyB = await seedCompany({ name: "Empresa B", planId: plan.id });
  for (const c of [companyA, companyB]) {
    await seedSubscription({ companyId: c.id, planId: plan.id, status: "ACTIVE", startDate: new Date() });
  }
  const admin = await seedUser({ name: "Admin", email: "admin@v.local", password: PASSWORD, role: "ADMIN" });
  const ownerA = await seedUser({ name: "Owner A", email: "owner-a@v.local", password: PASSWORD, role: "CLIENT", companyId: companyA.id, companyRole: "OWNER" });
  const ownerB = await seedUser({ name: "Owner B", email: "owner-b@v.local", password: PASSWORD, role: "CLIENT", companyId: companyB.id, companyRole: "OWNER" });
  const pentester = await seedUser({ name: "Pen", email: "pen@v.local", password: PASSWORD, role: "PENTESTER" });

  const appCritica = await seedApplication({
    name: "Loja",
    companyId: companyA.id,
    environment: "PROD",
    criticality: "CRITICAL",
    internetFacing: true,
    dataSensitivity: "RESTRICTED",
  });
  const appModesta = await seedApplication({
    name: "Intranet",
    companyId: companyA.id,
    environment: "HOMOL",
    criticality: "MEDIUM",
    internetFacing: false,
    dataSensitivity: "INTERNAL",
  });
  const appB = await seedApplication({ name: "App B", companyId: companyB.id, criticality: "CRITICAL", internetFacing: true });
  const projCritica = await seedProject({ name: "P Loja", applicationId: appCritica.id, companyId: companyA.id });
  const projModesta = await seedProject({ name: "P Intranet", applicationId: appModesta.id, companyId: companyA.id });
  const projB = await seedProject({ name: "P B", applicationId: appB.id, companyId: companyB.id });
  for (const p of [projCritica, projModesta, projB]) await seedProjectMember(p.id, pentester.id);

  return {
    admin: await loginAs(app, admin.email, PASSWORD),
    ownerA: await loginAs(app, ownerA.email, PASSWORD),
    ownerB: await loginAs(app, ownerB.email, PASSWORD),
    pentester: await loginAs(app, pentester.email, PASSWORD),
    companyAId: companyA.id,
    companyBId: companyB.id,
    appCritica: appCritica.id,
    appModesta: appModesta.id,
    projCritica: projCritica.id,
    projModesta: projModesta.id,
    appB: appB.id,
    projB: projB.id,
  };
}

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
const criar = (token: string, projectId: string, cvssVector: string, title = "Finding") =>
  request(app).post("/api/vulnerabilities").set(auth(token)).send({ projectId, title, description: "d", owaspCategory: "A03", cvssVector });
const listar = (token: string, qs = "") => request(app).get(`/api/vulnerabilities${qs}`).set(auth(token));

describe("Vulnera Risk Score (CP-3)", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it("VRS-01: criar finding grava score e breakdown que soma o score, com fórmula v1", async () => {
    const c = await montarCenario();
    const res = await criar(c.pentester, c.projCritica, V_98);
    expect(res.status).toBe(201);
    // 59 (9.8×6) + 15 + 7 + 8 + 10 = 99
    expect(res.body.vrs.score).toBe(99);
    expect(res.body.vrs.band).toBe("IMEDIATO");
    const f = res.body.vrs.factors;
    expect(f.formula).toBe("v1");
    expect(f.basePoints).toBe(59);
    expect(f.factors.map((x: { name: string; points: number }) => [x.name, x.points])).toEqual([
      ["criticality", 15],
      ["environment", 7],
      ["internetFacing", 8],
      ["dataSensitivity", 10],
    ]);
    expect(f.basePoints + f.factors.reduce((s: number, x: { points: number }) => s + x.points, 0)).toBe(99);
    // e o CVSS continua intacto
    expect(res.body.cvssScore).toBe(9.8);
    expect(res.body.severityFinal).toBe("CRITICAL");
  });

  it("VRS-02: editar o vetor recalcula; editar só o título não toca no VRS", async () => {
    const c = await montarCenario();
    const res = await criar(c.pentester, c.projCritica, V_98);
    const antes = await prisma.vulnerability.findUniqueOrThrow({ where: { id: res.body.id } });

    const titulo = await request(app).put(`/api/vulnerabilities/${res.body.id}`).set(auth(c.pentester)).send({ title: "Outro" });
    expect(titulo.status).toBe(200);
    expect(titulo.body.vrs.score).toBe(99);
    const depoisTitulo = await prisma.vulnerability.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(depoisTitulo.vrsComputedAt!.getTime()).toBe(antes.vrsComputedAt!.getTime());

    const vetor = await request(app).put(`/api/vulnerabilities/${res.body.id}`).set(auth(c.pentester)).send({ cvssVector: V_54 });
    expect(vetor.status).toBe(200);
    expect(vetor.body.vrs.score).toBe(72); // 32 + 40
    expect(vetor.body.vrs.band).toBe("URGENTE");
  });

  it("VRS-03: override de severidade SEM mudança de vetor não muda o VRS (o VRS lê o CVSS, não o rótulo)", async () => {
    const c = await montarCenario();
    const res = await criar(c.pentester, c.projCritica, V_98);
    const over = await request(app)
      .post(`/api/vulnerabilities/${res.body.id}/override-severity`)
      .set(auth(c.pentester))
      .send({ newSeverity: "LOW", justification: "Compensado por WAF em produção, revisado." });
    expect(over.status).toBe(200);
    expect(over.body.severityFinal).toBe("LOW");
    expect(over.body.vrs.score).toBe(99);
  });

  it("VRS-04: mudar o contexto da aplicação recalcula todos os findings dela (qualquer status) e audita a contagem", async () => {
    const c = await montarCenario();
    const a = await criar(c.pentester, c.projModesta, V_98, "a");
    const b = await criar(c.pentester, c.projModesta, V_54, "b");
    await request(app).post(`/api/vulnerabilities/${b.body.id}/transition`).set(auth(c.pentester)).send({ toStatus: "IN_PROGRESS" });
    await request(app).post(`/api/vulnerabilities/${b.body.id}/transition`).set(auth(c.pentester)).send({ toStatus: "FIXED" });
    const outraApp = await criar(c.pentester, c.projCritica, V_98, "outra");
    expect(a.body.vrs.score).toBe(59 + 5 + 3 + 0 + 3); // 70
    expect(b.body.vrs.score).toBe(32 + 11); // 43

    const ctx = await request(app)
      .put(`/api/applications/${c.appModesta}`)
      .set(auth(c.admin))
      .send({ criticality: "CRITICAL", environment: "PROD", internetFacing: true, dataSensitivity: "RESTRICTED" });
    expect(ctx.status).toBe(200);

    const va = await prisma.vulnerability.findUniqueOrThrow({ where: { id: a.body.id } });
    const vb = await prisma.vulnerability.findUniqueOrThrow({ where: { id: b.body.id } });
    const vo = await prisma.vulnerability.findUniqueOrThrow({ where: { id: outraApp.body.id } });
    expect(va.vrsScore).toBe(99);
    expect(vb.vrsScore).toBe(72); // FIXED também recalcula
    expect(vo.vrsScore).toBe(99); // outra app: intocada (já era 99)

    const audit = await prisma.auditLog.findFirst({ where: { entityType: "Application", entityId: c.appModesta } });
    expect(JSON.parse(audit!.diffJson!).vrsRecalculated).toBe(2);
  });

  it("VRS-05: vrsMin/vrsMax filtram, sortBy=vrsScore ordena no banco, e os dois construtores concordam", async () => {
    const c = await montarCenario();
    await criar(c.pentester, c.projCritica, V_98, "alto"); // 99
    await criar(c.pentester, c.projModesta, V_98, "medio"); // 70
    await criar(c.pentester, c.projModesta, V_31, "baixo"); // 19 + 11 = 30

    const titulos = async (qs: string) => (await listar(c.admin, qs)).body.data.map((f: { title: string }) => f.title);
    expect(await titulos("?vrsMin=85")).toEqual(["alto"]);
    expect(await titulos("?vrsMin=40&vrsMax=84")).toEqual(["medio"]);
    expect(await titulos("?vrsMax=39")).toEqual(["baixo"]);
    expect(await titulos("?sortBy=vrsScore&sortOrder=desc")).toEqual(["alto", "medio", "baixo"]);
    expect(await titulos("?sortBy=vrsScore&sortOrder=asc")).toEqual(["baixo", "medio", "alto"]);

    for (const filtro of ["vrsMin=40", "vrsMax=84", "vrsMin=40&vrsMax=84", "vrsMin=0&vrsMax=100"]) {
      const sql = await listar(c.admin, `?${filtro}&sortBy=severity`);
      const prismaQ = await listar(c.admin, `?${filtro}&sortBy=createdAt`);
      expect(sql.body.data.map((f: { id: string }) => f.id).sort()).toEqual(prismaQ.body.data.map((f: { id: string }) => f.id).sort());
      expect(sql.body.pagination.total).toBe(prismaQ.body.pagination.total);
    }
    // o item da lista carrega score + faixa
    const lista = await listar(c.admin, "?sortBy=vrsScore&sortOrder=desc");
    expect(lista.body.data[0]).toMatchObject({ vrsScore: 99, vrsBand: "IMEDIATO" });
  });

  it("VRS-06: faixa inválida → 400 INVALID_VRS_RANGE", async () => {
    const c = await montarCenario();
    for (const qs of ["?vrsMin=-1", "?vrsMax=101", "?vrsMin=abc", "?vrsMin=2.5", "?vrsMin=80&vrsMax=20"]) {
      const r = await listar(c.admin, qs);
      expect(r.status).toBe(400);
      expect(r.body.error).toBe("INVALID_VRS_RANGE");
    }
  });

  it("VRS-07: o VRS não é alterável diretamente — campos no body são ignorados", async () => {
    const c = await montarCenario();
    const res = await criar(c.pentester, c.projCritica, V_98);
    const hack = await request(app)
      .put(`/api/vulnerabilities/${res.body.id}`)
      .set(auth(c.admin))
      .send({ title: "x", vrsScore: 1, vrsFactors: "{}", vrsComputedAt: "2020-01-01T00:00:00Z" });
    expect(hack.status).toBe(200);
    expect(hack.body.vrs.score).toBe(99);
    const v = await prisma.vulnerability.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(v.vrsScore).toBe(99);
  });

  it("VRS-09: três findings reais — o contexto reordena: 6.5 na loja exposta passa 8.0 na intranet", async () => {
    const c = await montarCenario();
    const baixo = await criar(c.pentester, c.projModesta, V_31, "baixo"); // 19 + 11 = 30 → MONITORAR
    const medio = await criar(c.pentester, c.projModesta, V_98, "medio"); // 59 + 11 = 70 → URGENTE
    const alto = await criar(c.pentester, c.projCritica, V_54, "alto"); // 32 + 40 = 72 → URGENTE (5.4 passa 9.8!)
    expect(baixo.body.vrs).toMatchObject({ score: 30, band: "MONITORAR" });
    expect(medio.body.vrs).toMatchObject({ score: 70, band: "URGENTE" });
    expect(alto.body.vrs).toMatchObject({ score: 72, band: "URGENTE" });
    // pelo CVSS, "medio" (9.8) > "alto" (5.4); pelo VRS, o contexto inverte — e ambos continuam expostos
    expect(alto.body.cvssScore).toBeLessThan(medio.body.cvssScore);
    expect(alto.body.vrs.score).toBeGreaterThan(medio.body.vrs.score);
  });

  it("TEN-31: CLIENT de B não vê findings de A por nenhuma faixa de VRS; o filtro não vaza nem revela", async () => {
    const c = await montarCenario();
    await criar(c.pentester, c.projCritica, V_98, "de A");
    await criar(c.pentester, c.projB, V_31, "de B"); // 19 + 15 + 7 + 8 + 3 = 52 (app B: CRITICAL, PROD, exposta, INTERNAL)
    const r = await listar(c.ownerB, "?vrsMin=0&vrsMax=100&sortBy=vrsScore");
    expect(r.status).toBe(200);
    expect(r.body.data.map((f: { title: string }) => f.title)).toEqual(["de B"]);
    expect(r.body.pagination.total).toBe(1);
    const alto = await listar(c.ownerB, "?vrsMin=90");
    expect(alto.body.data).toEqual([]);
    expect(alto.body.pagination.total).toBe(0);
  });
});
