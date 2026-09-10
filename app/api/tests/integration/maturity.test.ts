import request from "supertest";
import { app } from "../../src/app";
import { cleanDatabase } from "../setup";
import { prisma } from "../../src/database/prisma.database";
import { seedUser } from "../fixtures/users.fixture";
import { seedPlan } from "../fixtures/plans.fixture";
import { seedCompany } from "../fixtures/companies.fixture";
import { seedApplication } from "../fixtures/applications.fixture";
import { seedProject, seedProjectMember } from "../fixtures/projects.fixture";
import { loginAs } from "../fixtures/auth.fixture";

const PASSWORD = "senha12345";

/** Catálogo mínimo direto no banco (bypass da API) — 1 domínio, 2 perguntas. */
async function seedCatalog() {
  const domain = await prisma.maturityDomain.create({
    data: { name: "Gestão de Acesso", description: "teste", sortOrder: 0 },
  });
  const control1 = await prisma.maturityControl.create({
    data: { domainId: domain.id, name: "Existe MFA obrigatório?", sortOrder: 0 },
  });
  const control2 = await prisma.maturityControl.create({
    data: { domainId: domain.id, name: "Há revisão periódica de acessos?", sortOrder: 1 },
  });
  return { domain, control1, control2 };
}

async function setupAdminAndCompany() {
  const plan = await seedPlan({ name: "BASIC" });
  const company = await seedCompany({ name: "Acme", planId: plan.id });
  const admin = await seedUser({ name: "Admin", email: "admin@vulnera.local", password: PASSWORD, role: "ADMIN" });
  const token = await loginAs(app, admin.email, PASSWORD);
  return { plan, company, admin, token };
}

describe("Maturity (assessments + scores)", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it("GET /api/maturity/catalog: lista domínios com perguntas aninhadas", async () => {
    const { control1 } = await seedCatalog();
    const admin = await seedUser({ name: "Admin", email: "admin@vulnera.local", password: PASSWORD, role: "ADMIN" });
    const token = await loginAs(app, admin.email, PASSWORD);

    const res = await request(app).get("/api/maturity/catalog").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe("Gestão de Acesso");
    expect(res.body[0].controls).toHaveLength(2);
    expect(res.body[0].controls[0].id).toBe(control1.id);
  });

  it("POST /api/maturity/assessments: ADMIN cria avaliação vazia; CLIENT recebe 403 (RN19)", async () => {
    const { company, token } = await setupAdminAndCompany();

    const asAdmin = await request(app)
      .post("/api/maturity/assessments")
      .set("Authorization", `Bearer ${token}`)
      .send({ companyId: company.id });
    expect(asAdmin.status).toBe(201);
    expect(asAdmin.body.companyId).toBe(company.id);
    expect(asAdmin.body.overallScore).toBe(0);
    expect(asAdmin.body.scores).toEqual([]);

    const client = await seedUser({
      name: "Cliente",
      email: "client@vulnera.local",
      password: PASSWORD,
      role: "CLIENT",
      companyId: company.id,
      companyRole: "OWNER",
    });
    const clientToken = await loginAs(app, client.email, PASSWORD);

    const asClient = await request(app)
      .post("/api/maturity/assessments")
      .set("Authorization", `Bearer ${clientToken}`)
      .send({ companyId: company.id });
    expect(asClient.status).toBe(403);
    expect(asClient.body.error).toBe("FORBIDDEN");
  });

  it("POST /api/maturity/assessments: company inexistente retorna 404", async () => {
    const { token } = await setupAdminAndCompany();
    const res = await request(app)
      .post("/api/maturity/assessments")
      .set("Authorization", `Bearer ${token}`)
      .send({ companyId: "nao-existe" });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("COMPANY_NOT_FOUND");
  });

  // MAT-01 — batch persiste e recalcula a média geral
  it("POST /api/maturity/assessments/:id/scores: batch persiste e recalcula a média simples", async () => {
    const { company, token } = await setupAdminAndCompany();
    const { control1, control2 } = await seedCatalog();

    const created = await request(app)
      .post("/api/maturity/assessments")
      .set("Authorization", `Bearer ${token}`)
      .send({ companyId: company.id });
    const assessmentId = created.body.id;

    const res = await request(app)
      .post(`/api/maturity/assessments/${assessmentId}/scores`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        scores: [
          { controlId: control1.id, score: 4, notes: "MFA ativo no SSO" },
          { controlId: control2.id, score: 2 },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.scores).toHaveLength(2);
    // média simples: (4+2)/2 = 3 — sem ponderação nenhuma
    expect(res.body.overallScore).toBe(3);
    expect(res.body.level).toBe("INTERMEDIATE");

    const persisted = await prisma.maturityScore.findMany({ where: { assessmentId } });
    expect(persisted).toHaveLength(2);
    const mfa = persisted.find((s) => s.controlId === control1.id);
    expect(mfa?.score).toBe(4);
    expect(mfa?.isCompliant).toBe(true); // score >= 4
    expect(mfa?.notes).toBe("MFA ativo no SSO");
  });

  it("POST .../scores: reenviar o mesmo controlId ATUALIZA o score em vez de duplicar", async () => {
    const { company, token } = await setupAdminAndCompany();
    const { control1 } = await seedCatalog();

    const created = await request(app)
      .post("/api/maturity/assessments")
      .set("Authorization", `Bearer ${token}`)
      .send({ companyId: company.id });
    const assessmentId = created.body.id;

    await request(app)
      .post(`/api/maturity/assessments/${assessmentId}/scores`)
      .set("Authorization", `Bearer ${token}`)
      .send({ scores: [{ controlId: control1.id, score: 2 }] });

    const second = await request(app)
      .post(`/api/maturity/assessments/${assessmentId}/scores`)
      .set("Authorization", `Bearer ${token}`)
      .send({ scores: [{ controlId: control1.id, score: 5 }] });

    expect(second.status).toBe(200);
    expect(second.body.scores).toHaveLength(1);
    expect(second.body.scores[0].score).toBe(5);
    expect(second.body.overallScore).toBe(5);

    const persisted = await prisma.maturityScore.findMany({ where: { assessmentId } });
    expect(persisted).toHaveLength(1);
  });

  it("POST .../scores: score fora de 1-5 retorna 400; controlId inexistente retorna 404; CLIENT recebe 403", async () => {
    const { company, token } = await setupAdminAndCompany();
    const { control1 } = await seedCatalog();

    const created = await request(app)
      .post("/api/maturity/assessments")
      .set("Authorization", `Bearer ${token}`)
      .send({ companyId: company.id });
    const assessmentId = created.body.id;

    const invalidScore = await request(app)
      .post(`/api/maturity/assessments/${assessmentId}/scores`)
      .set("Authorization", `Bearer ${token}`)
      .send({ scores: [{ controlId: control1.id, score: 7 }] });
    expect(invalidScore.status).toBe(400);
    expect(invalidScore.body.error).toBe("INVALID_SCORE_VALUE");

    const missingControl = await request(app)
      .post(`/api/maturity/assessments/${assessmentId}/scores`)
      .set("Authorization", `Bearer ${token}`)
      .send({ scores: [{ controlId: "nao-existe", score: 3 }] });
    expect(missingControl.status).toBe(404);
    expect(missingControl.body.error).toBe("CONTROL_NOT_FOUND");

    const client = await seedUser({
      name: "Cliente",
      email: "client@vulnera.local",
      password: PASSWORD,
      role: "CLIENT",
      companyId: company.id,
      companyRole: "OWNER",
    });
    const clientToken = await loginAs(app, client.email, PASSWORD);
    const asClient = await request(app)
      .post(`/api/maturity/assessments/${assessmentId}/scores`)
      .set("Authorization", `Bearer ${clientToken}`)
      .send({ scores: [{ controlId: control1.id, score: 3 }] });
    expect(asClient.status).toBe(403);
  });

  // MAT-02 — GET .../latest devolve a avaliação MAIS RECENTE
  it("GET /api/maturity/assessments/:companyId/latest: devolve a mais recente entre várias", async () => {
    const { company, admin, token } = await setupAdminAndCompany();

    const older = await prisma.maturityAssessment.create({
      data: { companyId: company.id, evaluatedBy: admin.id, overallScore: 1.5, level: "BASIC", createdAt: new Date(Date.now() - 10_000) },
    });
    const newer = await prisma.maturityAssessment.create({
      data: { companyId: company.id, evaluatedBy: admin.id, overallScore: 4.2, level: "ADVANCED" },
    });

    const res = await request(app)
      .get(`/api/maturity/assessments/${company.id}/latest`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(newer.id);
    expect(res.body.id).not.toBe(older.id);
    expect(res.body.overallScore).toBe(4.2);
  });

  it("GET .../latest: 404 ASSESSMENT_NOT_FOUND quando a company não tem avaliação", async () => {
    const { company, token } = await setupAdminAndCompany();
    const res = await request(app)
      .get(`/api/maturity/assessments/${company.id}/latest`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("ASSESSMENT_NOT_FOUND");
  });

  // MAT-03 — isolamento por company (RN16/RN19)
  it("GET .../latest: CLIENT de outra company recebe 403; CLIENT da própria company vê", async () => {
    const { company, admin } = await setupAdminAndCompany();
    await prisma.maturityAssessment.create({
      data: { companyId: company.id, evaluatedBy: admin.id, overallScore: 3, level: "INTERMEDIATE" },
    });

    const owner = await seedUser({
      name: "Cliente Dono",
      email: "owner@acme.local",
      password: PASSWORD,
      role: "CLIENT",
      companyId: company.id,
      companyRole: "OWNER",
    });
    const ownerToken = await loginAs(app, owner.email, PASSWORD);
    const asOwner = await request(app)
      .get(`/api/maturity/assessments/${company.id}/latest`)
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(asOwner.status).toBe(200);

    const otherPlan = await seedPlan({ name: "PRO" });
    const otherCompany = await seedCompany({ name: "Other Corp", planId: otherPlan.id });
    const outsider = await seedUser({
      name: "Cliente Outsider",
      email: "outsider@other.local",
      password: PASSWORD,
      role: "CLIENT",
      companyId: otherCompany.id,
      companyRole: "OWNER",
    });
    const outsiderToken = await loginAs(app, outsider.email, PASSWORD);
    const asOutsider = await request(app)
      .get(`/api/maturity/assessments/${company.id}/latest`)
      .set("Authorization", `Bearer ${outsiderToken}`);
    expect(asOutsider.status).toBe(403);
    expect(asOutsider.body.error).toBe("FORBIDDEN");
  });

  it("GET .../latest: PENTESTER atribuído a um projeto da company vê; não-atribuído recebe 403 (RN19)", async () => {
    const { company, admin } = await setupAdminAndCompany();
    await prisma.maturityAssessment.create({
      data: { companyId: company.id, evaluatedBy: admin.id, overallScore: 3, level: "INTERMEDIATE" },
    });
    const application = await seedApplication({ name: "App 1", companyId: company.id });
    const project = await seedProject({ name: "Projeto 1", applicationId: application.id, companyId: company.id });

    const assigned = await seedUser({ name: "Pentester Atribuído", email: "assigned@vulnera.local", password: PASSWORD, role: "PENTESTER" });
    await seedProjectMember(project.id, assigned.id);
    const assignedToken = await loginAs(app, assigned.email, PASSWORD);
    const asAssigned = await request(app)
      .get(`/api/maturity/assessments/${company.id}/latest`)
      .set("Authorization", `Bearer ${assignedToken}`);
    expect(asAssigned.status).toBe(200);

    const stranger = await seedUser({ name: "Pentester Estranho", email: "stranger@vulnera.local", password: PASSWORD, role: "PENTESTER" });
    const strangerToken = await loginAs(app, stranger.email, PASSWORD);
    const asStranger = await request(app)
      .get(`/api/maturity/assessments/${company.id}/latest`)
      .set("Authorization", `Bearer ${strangerToken}`);
    expect(asStranger.status).toBe(403);
  });
});
