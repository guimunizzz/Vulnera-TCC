/**
 * application-risk-context.test.ts (integration)
 *
 * Contexto de risco da Application (CP-1 — Exposure & Remediation).
 *
 * O que está em jogo: `criticality`, `environment`, `internetFacing` e
 * `dataSensitivity` alimentam o VRS de TODOS os findings da aplicação. Quem
 * pode rebaixá-los pode esvaziar o score sem corrigir nada — por isso a
 * regra D2 é assimétrica (subir: OWNER; descer: só ADMIN), e por isso o
 * cenário multi-tenant aqui tem DUAS empresas desde o primeiro teste.
 *
 * Canários:
 *   CTX-01  defaults da migration
 *   CTX-02  validação dos valores → 400
 *   CTX-03  ADMIN sobe E desce
 *   CTX-04  CLIENT OWNER sobe
 *   CTX-05  CLIENT OWNER tenta descer → 403 RISK_CONTEXT_REDUCTION_REQUIRES_ADMIN
 *   CTX-06  CLIENT MEMBER não altera contexto (nem subir) → 403
 *   CTX-07  PENTESTER não altera → 403
 *   CTX-08  toda mudança gera AuditLog RISK_CONTEXT_CHANGED com antes/depois
 *   CTX-09  GET /vulnerabilities/:id embute applicationContext (para o PENTESTER também)
 *   CTX-10  campos não-risco (name, donos) continuam editáveis por qualquer CLIENT da company
 *   TEN-29  CLIENT OWNER da empresa B não altera contexto de app da empresa A → 403
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

const PASSWORD = "senha12345";

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
};

/** Duas empresas, uma app em cada, um pentester membro do projeto da A. */
async function montarCenario(): Promise<Cenario> {
  const plan = await seedPlan({ name: "PRO", maxApplications: 5 });
  const companyA = await seedCompany({ name: "Empresa A", planId: plan.id });
  const companyB = await seedCompany({ name: "Empresa B", planId: plan.id });
  await seedSubscription({ companyId: companyA.id, planId: plan.id, status: "ACTIVE", startDate: new Date() });
  await seedSubscription({ companyId: companyB.id, planId: plan.id, status: "ACTIVE", startDate: new Date() });

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
  await seedApplication({ name: "App B", companyId: companyB.id });

  const projectA = await seedProject({ name: "Proj A", applicationId: appA.id, companyId: companyA.id });
  await seedProjectMember(projectA.id, pentester.id);

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
  };
}

const put = (token: string, id: string, body: object) =>
  request(app).put(`/api/applications/${id}`).set("Authorization", `Bearer ${token}`).send(body);

describe("Application — contexto de risco (CP-1)", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it("CTX-01: app criada sem contexto nasce com os defaults da migration (MEDIUM / false / INTERNAL)", async () => {
    const c = await montarCenario();
    const res = await request(app).get(`/api/applications/${c.appAId}`).set("Authorization", `Bearer ${c.ownerA}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      criticality: "MEDIUM",
      internetFacing: false,
      dataSensitivity: "INTERNAL",
      businessOwner: null,
      technicalOwner: null,
    });
  });

  it("CTX-02: valor fora do vocabulário é 400 com código do campo", async () => {
    const c = await montarCenario();
    expect((await put(c.admin, c.appAId, { criticality: "URGENTE" })).body.error).toBe("INVALID_CRITICALITY");
    expect((await put(c.admin, c.appAId, { dataSensitivity: "SECRET" })).body.error).toBe("INVALID_DATA_SENSITIVITY");
    expect((await put(c.admin, c.appAId, { internetFacing: "sim" })).body.error).toBe("INVALID_INTERNET_FACING");
    expect((await put(c.admin, c.appAId, { environment: "STAGING" })).body.error).toBe("INVALID_ENVIRONMENT");
    expect((await put(c.admin, c.appAId, { businessOwner: "x".repeat(200) })).body.error).toBe("INVALID_BUSINESS_OWNER");
    // e o registro continua intacto
    const res = await request(app).get(`/api/applications/${c.appAId}`).set("Authorization", `Bearer ${c.admin}`);
    expect(res.body.criticality).toBe("MEDIUM");
  });

  it("CTX-03: ADMIN sobe e desce qualquer dimensão", async () => {
    const c = await montarCenario();
    const sobe = await put(c.admin, c.appAId, {
      criticality: "CRITICAL",
      internetFacing: true,
      dataSensitivity: "RESTRICTED",
      environment: "PROD",
    });
    expect(sobe.status).toBe(200);
    expect(sobe.body).toMatchObject({ criticality: "CRITICAL", internetFacing: true, dataSensitivity: "RESTRICTED" });

    const desce = await put(c.admin, c.appAId, {
      criticality: "LOW",
      internetFacing: false,
      dataSensitivity: "PUBLIC",
      environment: "DEV",
    });
    expect(desce.status).toBe(200);
    expect(desce.body).toMatchObject({
      criticality: "LOW",
      internetFacing: false,
      dataSensitivity: "PUBLIC",
      environment: "DEV",
    });
  });

  it("CTX-04: CLIENT OWNER sobe o risco (MEDIUM→HIGH, false→true, INTERNAL→CONFIDENTIAL, HOMOL→PROD)", async () => {
    const c = await montarCenario();
    await put(c.admin, c.appAId, { environment: "HOMOL" });
    const res = await put(c.ownerA, c.appAId, {
      criticality: "HIGH",
      internetFacing: true,
      dataSensitivity: "CONFIDENTIAL",
      environment: "PROD",
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      criticality: "HIGH",
      internetFacing: true,
      dataSensitivity: "CONFIDENTIAL",
      environment: "PROD",
    });
  });

  it("CTX-05: CLIENT OWNER tenta REDUZIR → 403 RISK_CONTEXT_REDUCTION_REQUIRES_ADMIN, e nada muda", async () => {
    const c = await montarCenario();
    await put(c.admin, c.appAId, { criticality: "CRITICAL", internetFacing: true, dataSensitivity: "RESTRICTED" });

    for (const tentativa of [
      { criticality: "HIGH" },
      { criticality: "LOW" },
      { internetFacing: false },
      { dataSensitivity: "INTERNAL" },
      { environment: "HOMOL" },
      // subir uma e descer outra na mesma chamada: a redução contamina o todo
      { criticality: "CRITICAL", internetFacing: false },
    ]) {
      const res = await put(c.ownerA, c.appAId, tentativa);
      expect(res.status).toBe(403);
      expect(res.body.error).toBe("RISK_CONTEXT_REDUCTION_REQUIRES_ADMIN");
    }

    const atual = await prisma.application.findUniqueOrThrow({ where: { id: c.appAId } });
    expect(atual).toMatchObject({
      criticality: "CRITICAL",
      internetFacing: true,
      dataSensitivity: "RESTRICTED",
      environment: "PROD",
    });
  });

  it("CTX-06: CLIENT MEMBER não altera contexto de risco em nenhuma direção → 403 FORBIDDEN", async () => {
    const c = await montarCenario();
    const sobe = await put(c.memberA, c.appAId, { criticality: "HIGH" });
    expect(sobe.status).toBe(403);
    expect(sobe.body.error).toBe("FORBIDDEN");
    const expoe = await put(c.memberA, c.appAId, { internetFacing: true });
    expect(expoe.status).toBe(403);
    // ...mas continua podendo editar o que sempre pôde
    const nome = await put(c.memberA, c.appAId, { name: "App A renomeada" });
    expect(nome.status).toBe(200);
    expect(nome.body.name).toBe("App A renomeada");
  });

  it("CTX-07: PENTESTER não altera contexto (continua sem acesso a /applications) → 403", async () => {
    const c = await montarCenario();
    const res = await put(c.pentester, c.appAId, { criticality: "LOW" });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("FORBIDDEN");
  });

  it("CTX-08: toda mudança de contexto gera AuditLog RISK_CONTEXT_CHANGED com antes/depois — e só ela", async () => {
    const c = await montarCenario();
    // mudança sem contexto: nenhum evento
    await put(c.ownerA, c.appAId, { name: "Só o nome" });
    expect(await prisma.auditLog.count({ where: { entityType: "Application", entityId: c.appAId } })).toBe(0);

    await put(c.ownerA, c.appAId, { criticality: "HIGH", internetFacing: true });
    const eventos = await prisma.auditLog.findMany({ where: { entityType: "Application", entityId: c.appAId } });
    expect(eventos).toHaveLength(1);
    expect(eventos[0]!.action).toBe("RISK_CONTEXT_CHANGED");
    expect(eventos[0]!.companyId).toBe(c.companyAId);

    const diff = JSON.parse(eventos[0]!.diffJson!);
    expect(diff.before).toMatchObject({ criticality: "MEDIUM", internetFacing: false });
    expect(diff.after).toMatchObject({ criticality: "HIGH", internetFacing: true });
    expect(diff.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "criticality", from: "MEDIUM", to: "HIGH", direction: "INCREASE" }),
        expect.objectContaining({ field: "internetFacing", from: false, to: true, direction: "INCREASE" }),
      ]),
    );
    expect(typeof diff.vrsRecalculated).toBe("number");
  });

  it("CTX-09: GET /vulnerabilities/:id embute applicationContext — inclusive para o PENTESTER, que não lê /applications", async () => {
    const c = await montarCenario();
    await put(c.admin, c.appAId, { criticality: "CRITICAL", internetFacing: true, dataSensitivity: "RESTRICTED" });
    const projeto = await prisma.project.findFirstOrThrow({ where: { applicationId: c.appAId } });
    const vuln = await seedVulnerability({
      projectId: projeto.id,
      applicationId: c.appAId,
      companyId: c.companyAId,
      createdBy: c.pentesterId,
    });

    for (const token of [c.pentester, c.ownerA, c.admin]) {
      const res = await request(app).get(`/api/vulnerabilities/${vuln.id}`).set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.applicationContext).toEqual({
        environment: "PROD",
        criticality: "CRITICAL",
        internetFacing: true,
        dataSensitivity: "RESTRICTED",
      });
    }
    // e o PENTESTER continua SEM o endpoint direto — o embed não abriu nada
    const direto = await request(app).get(`/api/applications/${c.appAId}`).set("Authorization", `Bearer ${c.pentester}`);
    expect(direto.status).toBe(403);
  });

  it("CTX-10: donos (businessOwner/technicalOwner) são texto livre, editáveis e limpáveis com null", async () => {
    const c = await montarCenario();
    const res = await put(c.ownerA, c.appAId, { businessOwner: "Diretoria Comercial", technicalOwner: "Squad X" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ businessOwner: "Diretoria Comercial", technicalOwner: "Squad X" });
    const limpa = await put(c.ownerA, c.appAId, { businessOwner: null });
    expect(limpa.status).toBe(200);
    expect(limpa.body.businessOwner).toBeNull();
    expect(limpa.body.technicalOwner).toBe("Squad X");
    // donos não são fator de risco: nenhum RISK_CONTEXT_CHANGED
    expect(await prisma.auditLog.count({ where: { entityType: "Application", entityId: c.appAId } })).toBe(0);
  });

  it("TEN-29: CLIENT OWNER da empresa B não altera contexto de app da empresa A → 403, sem revelar nada", async () => {
    const c = await montarCenario();
    const res = await put(c.ownerB, c.appAId, { criticality: "CRITICAL" });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("FORBIDDEN");
    const leitura = await request(app).get(`/api/applications/${c.appAId}`).set("Authorization", `Bearer ${c.ownerB}`);
    expect(leitura.status).toBe(403);
    const atual = await prisma.application.findUniqueOrThrow({ where: { id: c.appAId } });
    expect(atual.criticality).toBe("MEDIUM");
  });

  it("CTX-11: na criação, CLIENT OWNER pode definir contexto; CLIENT MEMBER só os campos de sempre", async () => {
    const c = await montarCenario();
    const owner = await request(app)
      .post("/api/applications")
      .set("Authorization", `Bearer ${c.ownerA}`)
      .send({ name: "Nova A", criticality: "CRITICAL", internetFacing: true, dataSensitivity: "RESTRICTED" });
    expect(owner.status).toBe(201);
    expect(owner.body).toMatchObject({ criticality: "CRITICAL", internetFacing: true, dataSensitivity: "RESTRICTED" });

    const memberComRisco = await request(app)
      .post("/api/applications")
      .set("Authorization", `Bearer ${c.memberA}`)
      .send({ name: "Nova A2", criticality: "CRITICAL" });
    expect(memberComRisco.status).toBe(403);

    const memberSemRisco = await request(app)
      .post("/api/applications")
      .set("Authorization", `Bearer ${c.memberA}`)
      .send({ name: "Nova A3", environment: "HOMOL" });
    expect(memberSemRisco.status).toBe(201);
    expect(memberSemRisco.body.criticality).toBe("MEDIUM");
  });
});
