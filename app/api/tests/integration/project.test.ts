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

describe("Project (list/getById/create/update/transition)", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  // PROJ-01
  it("POST /api/projects: 1-para-1 com Application — 2ª tentativa retorna 409", async () => {
    const plan = await seedPlan({ name: "BASIC" });
    const company = await seedCompany({ name: "Acme", planId: plan.id });
    const application = await seedApplication({ name: "App 1", companyId: company.id });
    const admin = await seedUser({ name: "Admin", email: "admin@vulnera.local", password: PASSWORD, role: "ADMIN" });
    const token = await loginAs(app, admin.email, PASSWORD);

    const first = await request(app)
      .post("/api/projects")
      .set("Authorization", `Bearer ${token}`)
      .send({ applicationId: application.id, name: "Projeto 1" });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post("/api/projects")
      .set("Authorization", `Bearer ${token}`)
      .send({ applicationId: application.id, name: "Projeto 2" });
    expect(second.status).toBe(409);
    expect(second.body.error).toBe("APPLICATION_ALREADY_HAS_PROJECT");
  });

  // PROJ-02
  it("companyId do projeto é sempre herdado da Application, nunca do body", async () => {
    const plan = await seedPlan({ name: "BASIC" });
    const company = await seedCompany({ name: "Acme", planId: plan.id });
    const otherCompany = await seedCompany({ name: "Other", planId: plan.id });
    const application = await seedApplication({ name: "App 1", companyId: company.id });
    const admin = await seedUser({ name: "Admin", email: "admin@vulnera.local", password: PASSWORD, role: "ADMIN" });
    const token = await loginAs(app, admin.email, PASSWORD);

    const res = await request(app)
      .post("/api/projects")
      .set("Authorization", `Bearer ${token}`)
      .send({ applicationId: application.id, name: "Projeto 1", companyId: otherCompany.id });

    expect(res.status).toBe(201);
    expect(res.body.companyId).toBe(company.id);
  });

  // PROJ-03
  it("máquina de estados completa (PENDING→IN_PROGRESS→IN_REVIEW→COMPLETED) grava AuditLog em cada transição", async () => {
    const plan = await seedPlan({ name: "BASIC" });
    const company = await seedCompany({ name: "Acme", planId: plan.id });
    const application = await seedApplication({ name: "App 1", companyId: company.id });
    const admin = await seedUser({ name: "Admin", email: "admin@vulnera.local", password: PASSWORD, role: "ADMIN" });
    const token = await loginAs(app, admin.email, PASSWORD);

    const created = await request(app)
      .post("/api/projects")
      .set("Authorization", `Bearer ${token}`)
      .send({ applicationId: application.id, name: "Projeto 1" });
    const projectId = created.body.id as string;

    for (const toStatus of ["IN_PROGRESS", "IN_REVIEW", "COMPLETED"]) {
      const res = await request(app)
        .post(`/api/projects/${projectId}/transition`)
        .set("Authorization", `Bearer ${token}`)
        .send({ toStatus });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe(toStatus);
    }

    const logs = await prisma.auditLog.findMany({
      where: { entityType: "Project", entityId: projectId, action: "STATUS_CHANGE" },
    });
    expect(logs).toHaveLength(3);
  });

  // PROJ-04
  it("transição inválida retorna 400; IN_REVIEW pode voltar pra IN_PROGRESS", async () => {
    const plan = await seedPlan({ name: "BASIC" });
    const company = await seedCompany({ name: "Acme", planId: plan.id });
    const application = await seedApplication({ name: "App 1", companyId: company.id });
    const admin = await seedUser({ name: "Admin", email: "admin@vulnera.local", password: PASSWORD, role: "ADMIN" });
    const token = await loginAs(app, admin.email, PASSWORD);

    const created = await request(app)
      .post("/api/projects")
      .set("Authorization", `Bearer ${token}`)
      .send({ applicationId: application.id, name: "Projeto 1" });
    const projectId = created.body.id as string;

    const invalid = await request(app)
      .post(`/api/projects/${projectId}/transition`)
      .set("Authorization", `Bearer ${token}`)
      .send({ toStatus: "COMPLETED" });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error).toBe("INVALID_STATUS_TRANSITION");

    await request(app)
      .post(`/api/projects/${projectId}/transition`)
      .set("Authorization", `Bearer ${token}`)
      .send({ toStatus: "IN_PROGRESS" });
    await request(app)
      .post(`/api/projects/${projectId}/transition`)
      .set("Authorization", `Bearer ${token}`)
      .send({ toStatus: "IN_REVIEW" });

    const back = await request(app)
      .post(`/api/projects/${projectId}/transition`)
      .set("Authorization", `Bearer ${token}`)
      .send({ toStatus: "IN_PROGRESS" });
    expect(back.status).toBe(200);
    expect(back.body.status).toBe("IN_PROGRESS");
  });

  // PROJ-05
  it("CLIENT não pode transicionar status (403 FORBIDDEN)", async () => {
    const plan = await seedPlan({ name: "BASIC" });
    const company = await seedCompany({ name: "Acme", planId: plan.id });
    const application = await seedApplication({ name: "App 1", companyId: company.id });
    const project = await seedProject({ name: "Projeto 1", applicationId: application.id, companyId: company.id });
    const client = await seedUser({
      name: "Client",
      email: "client@vulnera.local",
      password: PASSWORD,
      role: "CLIENT",
      companyId: company.id,
      companyRole: "OWNER",
    });
    const token = await loginAs(app, client.email, PASSWORD);

    const res = await request(app)
      .post(`/api/projects/${project.id}/transition`)
      .set("Authorization", `Bearer ${token}`)
      .send({ toStatus: "IN_PROGRESS" });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("FORBIDDEN");
  });

  // TEN-04
  it("PENTESTER não-membro não vê nem transiciona o projeto (403)", async () => {
    const plan = await seedPlan({ name: "BASIC" });
    const company = await seedCompany({ name: "Acme", planId: plan.id });
    const application = await seedApplication({ name: "App 1", companyId: company.id });
    const project = await seedProject({ name: "Projeto 1", applicationId: application.id, companyId: company.id });
    const pentester = await seedUser({
      name: "Pentester",
      email: "pentester@vulnera.local",
      password: PASSWORD,
      role: "PENTESTER",
    });
    const token = await loginAs(app, pentester.email, PASSWORD);

    const getRes = await request(app).get(`/api/projects/${project.id}`).set("Authorization", `Bearer ${token}`);
    expect(getRes.status).toBe(403);

    const transitionRes = await request(app)
      .post(`/api/projects/${project.id}/transition`)
      .set("Authorization", `Bearer ${token}`)
      .send({ toStatus: "IN_PROGRESS" });
    expect(transitionRes.status).toBe(403);
  });

  // TEN-05
  it("PENTESTER membro só vê e transiciona os projetos onde está atribuído (RN17)", async () => {
    const plan = await seedPlan({ name: "BASIC" });
    const company = await seedCompany({ name: "Acme", planId: plan.id });
    const applicationA = await seedApplication({ name: "App A", companyId: company.id });
    const applicationB = await seedApplication({ name: "App B", companyId: company.id });
    const projectA = await seedProject({ name: "Projeto A", applicationId: applicationA.id, companyId: company.id });
    await seedProject({ name: "Projeto B", applicationId: applicationB.id, companyId: company.id });

    const pentester = await seedUser({
      name: "Pentester",
      email: "pentester@vulnera.local",
      password: PASSWORD,
      role: "PENTESTER",
    });
    await seedProjectMember(projectA.id, pentester.id);
    const token = await loginAs(app, pentester.email, PASSWORD);

    const list = await request(app).get("/api/projects").set("Authorization", `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].id).toBe(projectA.id);

    const transition = await request(app)
      .post(`/api/projects/${projectA.id}/transition`)
      .set("Authorization", `Bearer ${token}`)
      .send({ toStatus: "IN_PROGRESS" });
    expect(transition.status).toBe(200);
  });

  // PROJ-06
  it("CLIENT cria projeto pra application da própria company; é bloqueado pra application de outra company", async () => {
    const plan = await seedPlan({ name: "BASIC" });
    const companyA = await seedCompany({ name: "Company A", planId: plan.id });
    const companyB = await seedCompany({ name: "Company B", planId: plan.id });
    const applicationA = await seedApplication({ name: "App A", companyId: companyA.id });
    const applicationB = await seedApplication({ name: "App B", companyId: companyB.id });
    const clientA = await seedUser({
      name: "Client A",
      email: "clientA@vulnera.local",
      password: PASSWORD,
      role: "CLIENT",
      companyId: companyA.id,
      companyRole: "OWNER",
    });
    const token = await loginAs(app, clientA.email, PASSWORD);

    const ownApp = await request(app)
      .post("/api/projects")
      .set("Authorization", `Bearer ${token}`)
      .send({ applicationId: applicationA.id, name: "Projeto A" });
    expect(ownApp.status).toBe(201);

    const otherApp = await request(app)
      .post("/api/projects")
      .set("Authorization", `Bearer ${token}`)
      .send({ applicationId: applicationB.id, name: "Projeto B" });
    expect(otherApp.status).toBe(403);
    expect(otherApp.body.error).toBe("FORBIDDEN");
  });

  // PROJ-07
  it("GET /api/projects: CLIENT vê só a própria company; ADMIN vê todas", async () => {
    const plan = await seedPlan({ name: "BASIC" });
    const companyA = await seedCompany({ name: "Company A", planId: plan.id });
    const companyB = await seedCompany({ name: "Company B", planId: plan.id });
    const applicationA = await seedApplication({ name: "App A", companyId: companyA.id });
    const applicationB = await seedApplication({ name: "App B", companyId: companyB.id });
    const projectA = await seedProject({ name: "Projeto A", applicationId: applicationA.id, companyId: companyA.id });
    await seedProject({ name: "Projeto B", applicationId: applicationB.id, companyId: companyB.id });

    const admin = await seedUser({ name: "Admin", email: "admin@vulnera.local", password: PASSWORD, role: "ADMIN" });
    const clientA = await seedUser({
      name: "Client A",
      email: "clientA@vulnera.local",
      password: PASSWORD,
      role: "CLIENT",
      companyId: companyA.id,
      companyRole: "OWNER",
    });
    const adminToken = await loginAs(app, admin.email, PASSWORD);
    const clientAToken = await loginAs(app, clientA.email, PASSWORD);

    const listAsClient = await request(app).get("/api/projects").set("Authorization", `Bearer ${clientAToken}`);
    expect(listAsClient.status).toBe(200);
    expect(listAsClient.body).toHaveLength(1);
    expect(listAsClient.body[0].id).toBe(projectA.id);

    const listAsAdmin = await request(app).get("/api/projects").set("Authorization", `Bearer ${adminToken}`);
    expect(listAsAdmin.status).toBe(200);
    expect(listAsAdmin.body).toHaveLength(2);
  });

  // PROJ-08
  it("GET /api/projects/:id: CLIENT vê o próprio, é bloqueado pro de outra company", async () => {
    const plan = await seedPlan({ name: "BASIC" });
    const companyA = await seedCompany({ name: "Company A", planId: plan.id });
    const companyB = await seedCompany({ name: "Company B", planId: plan.id });
    const applicationA = await seedApplication({ name: "App A", companyId: companyA.id });
    const applicationB = await seedApplication({ name: "App B", companyId: companyB.id });
    const projectA = await seedProject({ name: "Projeto A", applicationId: applicationA.id, companyId: companyA.id });
    const projectB = await seedProject({ name: "Projeto B", applicationId: applicationB.id, companyId: companyB.id });

    const clientA = await seedUser({
      name: "Client A",
      email: "clientA@vulnera.local",
      password: PASSWORD,
      role: "CLIENT",
      companyId: companyA.id,
      companyRole: "OWNER",
    });
    const token = await loginAs(app, clientA.email, PASSWORD);

    const own = await request(app).get(`/api/projects/${projectA.id}`).set("Authorization", `Bearer ${token}`);
    expect(own.status).toBe(200);

    const other = await request(app).get(`/api/projects/${projectB.id}`).set("Authorization", `Bearer ${token}`);
    expect(other.status).toBe(403);
  });

  // PROJ-09
  it("PUT /api/projects/:id: ADMIN e CLIENT dono editam metadados; PENTESTER e CLIENT de outra company são bloqueados", async () => {
    const plan = await seedPlan({ name: "BASIC" });
    const companyA = await seedCompany({ name: "Company A", planId: plan.id });
    const companyB = await seedCompany({ name: "Company B", planId: plan.id });
    const applicationA = await seedApplication({ name: "App A", companyId: companyA.id });
    const projectA = await seedProject({ name: "Projeto A", applicationId: applicationA.id, companyId: companyA.id });

    const admin = await seedUser({ name: "Admin", email: "admin@vulnera.local", password: PASSWORD, role: "ADMIN" });
    const clientA = await seedUser({
      name: "Client A",
      email: "clientA@vulnera.local",
      password: PASSWORD,
      role: "CLIENT",
      companyId: companyA.id,
      companyRole: "OWNER",
    });
    const clientB = await seedUser({
      name: "Client B",
      email: "clientB@vulnera.local",
      password: PASSWORD,
      role: "CLIENT",
      companyId: companyB.id,
      companyRole: "OWNER",
    });
    const pentester = await seedUser({
      name: "Pentester",
      email: "pentester@vulnera.local",
      password: PASSWORD,
      role: "PENTESTER",
    });
    await seedProjectMember(projectA.id, pentester.id);

    const adminToken = await loginAs(app, admin.email, PASSWORD);
    const clientAToken = await loginAs(app, clientA.email, PASSWORD);
    const clientBToken = await loginAs(app, clientB.email, PASSWORD);
    const pentesterToken = await loginAs(app, pentester.email, PASSWORD);

    const asOwner = await request(app)
      .put(`/api/projects/${projectA.id}`)
      .set("Authorization", `Bearer ${clientAToken}`)
      .send({ notes: "Atualizado pelo cliente dono" });
    expect(asOwner.status).toBe(200);
    expect(asOwner.body.notes).toBe("Atualizado pelo cliente dono");

    const asAdmin = await request(app)
      .put(`/api/projects/${projectA.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ notes: "Atualizado pelo admin" });
    expect(asAdmin.status).toBe(200);

    const asOtherClient = await request(app)
      .put(`/api/projects/${projectA.id}`)
      .set("Authorization", `Bearer ${clientBToken}`)
      .send({ notes: "Hack" });
    expect(asOtherClient.status).toBe(403);

    const asPentester = await request(app)
      .put(`/api/projects/${projectA.id}`)
      .set("Authorization", `Bearer ${pentesterToken}`)
      .send({ notes: "Pentester tentando editar metadados" });
    expect(asPentester.status).toBe(403);
  });
});
