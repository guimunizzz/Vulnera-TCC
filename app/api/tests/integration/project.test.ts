import request from "supertest";
import { app } from "../../src/app";
import { cleanDatabase } from "../setup";
import { prisma } from "../../src/database/prisma.database";
import { seedUser } from "../fixtures/users.fixture";
import { seedPlan } from "../fixtures/plans.fixture";
import { seedCompany } from "../fixtures/companies.fixture";
import { seedApplication } from "../fixtures/applications.fixture";
import { seedSubscription } from "../fixtures/subscriptions.fixture";
import { seedProject, seedProjectMember } from "../fixtures/projects.fixture";
import { loginAs } from "../fixtures/auth.fixture";

const PASSWORD = "senha12345";

async function seedActiveSubscription(companyId: string, planId: string) {
  return seedSubscription({ companyId, planId, status: "ACTIVE", startDate: new Date() });
}

describe("Project (list/getById/create/update/transition)", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  // PROJ-01
  it("POST /api/projects: 1-para-1 com Application — 2ª tentativa retorna 409", async () => {
    const plan = await seedPlan({ name: "BASIC" });
    const company = await seedCompany({ name: "Acme", planId: plan.id });
    await seedActiveSubscription(company.id, plan.id);
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
    expect(first.body.status).toBe("PENDING");
    expect(first.body.analysisType).toBe("DAST");
    expect(first.body.analysisLevel).toBe("BASIC");
    expect(first.body.hasRemediation).toBe(false);
  });

  // PROJ-02
  it("companyId do projeto é sempre herdado da Application, nunca do body", async () => {
    const plan = await seedPlan({ name: "BASIC" });
    const company = await seedCompany({ name: "Acme", planId: plan.id });
    const otherCompany = await seedCompany({ name: "Other", planId: plan.id });
    await seedActiveSubscription(company.id, plan.id);
    const application = await seedApplication({ name: "App 1", companyId: company.id });
    const admin = await seedUser({ name: "Admin", email: "admin@vulnera.local", password: PASSWORD, role: "ADMIN" });
    const token = await loginAs(app, admin.email, PASSWORD);

    const res = await request(app)
      .post("/api/projects")
      .set("Authorization", `Bearer ${token}`)
      .send({ applicationId: application.id, name: "  Projeto 1  ", companyId: otherCompany.id, status: "COMPLETED" });

    expect(res.status).toBe(201);
    expect(res.body.companyId).toBe(company.id);
    expect(res.body.name).toBe("Projeto 1");
    expect(res.body.status).toBe("PENDING");
  });

  // PROJ-03
  it("máquina de estados completa (PENDING→IN_PROGRESS→IN_REVIEW→COMPLETED) grava AuditLog em cada transição", async () => {
    const plan = await seedPlan({ name: "BASIC" });
    const company = await seedCompany({ name: "Acme", planId: plan.id });
    await seedActiveSubscription(company.id, plan.id);
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
    await seedActiveSubscription(company.id, plan.id);
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

    const createRes = await request(app)
      .post("/api/projects")
      .set("Authorization", `Bearer ${token}`)
      .send({ applicationId: application.id, name: "Tentativa de criação" });
    expect(createRes.status).toBe(403);
    expect(createRes.body.error).toBe("FORBIDDEN");
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
    await seedActiveSubscription(companyA.id, plan.id);
    await seedActiveSubscription(companyB.id, plan.id);
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

    const member = await seedUser({
      name: "Client Member",
      email: "member@vulnera.local",
      password: PASSWORD,
      role: "CLIENT",
      companyId: companyA.id,
      companyRole: "MEMBER",
    });
    const memberToken = await loginAs(app, member.email, PASSWORD);
    const memberApplication = await seedApplication({ name: "App Member", companyId: companyA.id });
    const memberCreate = await request(app)
      .post("/api/projects")
      .set("Authorization", `Bearer ${memberToken}`)
      .send({ applicationId: memberApplication.id, name: "Projeto do membro" });
    expect(memberCreate.status).toBe(201);

    const clientWithoutCompany = await seedUser({
      name: "Client sem empresa",
      email: "sem-empresa@vulnera.local",
      password: PASSWORD,
      role: "CLIENT",
    });
    const noCompanyToken = await loginAs(app, clientWithoutCompany.email, PASSWORD);
    const noCompanyCreate = await request(app)
      .post("/api/projects")
      .set("Authorization", `Bearer ${noCompanyToken}`)
      .send({ applicationId: applicationA.id, name: "Projeto sem empresa" });
    expect(noCompanyCreate.status).toBe(403);
    expect(noCompanyCreate.body.error).toBe("FORBIDDEN");
  });

  it("ADMIN usa assinatura e plano da empresa da Application, mesmo tendo outra empresa pessoal", async () => {
    const companyPlan = await seedPlan({ name: "COMPANY_PLAN", maxProjects: 1, includesRemediation: false });
    const subscriptionPlan = await seedPlan({ name: "ACTIVE_PLAN", maxProjects: 2, includesRemediation: true });
    const personalCompany = await seedCompany({ name: "Empresa pessoal do admin", planId: companyPlan.id });
    const targetCompany = await seedCompany({ name: "Empresa da aplicação", planId: companyPlan.id });
    await seedActiveSubscription(targetCompany.id, subscriptionPlan.id);
    const existingApplication = await seedApplication({ name: "App existente", companyId: targetCompany.id });
    await seedProject({ name: "Projeto existente", applicationId: existingApplication.id, companyId: targetCompany.id });
    const targetApplication = await seedApplication({ name: "App novo", companyId: targetCompany.id });
    const admin = await seedUser({
      name: "Admin vinculado a outra empresa",
      email: "admin-outra-company@vulnera.local",
      password: PASSWORD,
      role: "ADMIN",
      companyId: personalCompany.id,
    });
    const token = await loginAs(app, admin.email, PASSWORD);

    const created = await request(app)
      .post("/api/projects")
      .set("Authorization", `Bearer ${token}`)
      .send({ applicationId: targetApplication.id, name: "Projeto contratado", hasRemediation: true });

    expect(created.status).toBe(201);
    expect(created.body.companyId).toBe(targetCompany.id);
    expect(created.body.hasRemediation).toBe(true);
  });

  it.each(["PENDING_APPROVAL", "REJECTED", "SUSPENDED", "CANCELED"])(
    "bloqueia criação com Subscription %s",
    async (status) => {
      const plan = await seedPlan({ name: "BASIC" });
      const company = await seedCompany({ name: "Acme", planId: plan.id });
      await seedSubscription({ companyId: company.id, planId: plan.id, status });
      const application = await seedApplication({ name: "App 1", companyId: company.id });
      const admin = await seedUser({ name: "Admin", email: "admin@vulnera.local", password: PASSWORD, role: "ADMIN" });
      const token = await loginAs(app, admin.email, PASSWORD);

      const res = await request(app)
        .post("/api/projects")
        .set("Authorization", `Bearer ${token}`)
        .send({ applicationId: application.id, name: "Projeto 1" });

      expect(res.status).toBe(422);
      expect(res.body.error).toBe("NO_ACTIVE_SUBSCRIPTION");
    },
  );

  it("bloqueia criação quando não existe Subscription", async () => {
    const plan = await seedPlan({ name: "BASIC" });
    const company = await seedCompany({ name: "Acme", planId: plan.id });
    const application = await seedApplication({ name: "App 1", companyId: company.id });
    const admin = await seedUser({ name: "Admin", email: "admin@vulnera.local", password: PASSWORD, role: "ADMIN" });
    const token = await loginAs(app, admin.email, PASSWORD);

    const res = await request(app)
      .post("/api/projects")
      .set("Authorization", `Bearer ${token}`)
      .send({ applicationId: application.id, name: "Projeto 1" });

    expect(res.status).toBe(422);
    expect(res.body.error).toBe("NO_ACTIVE_SUBSCRIPTION");
  });

  it("limita projetos simultâneos contando PENDING, IN_PROGRESS e IN_REVIEW", async () => {
    const plan = await seedPlan({ name: "BASIC", maxProjects: 3 });
    const company = await seedCompany({ name: "Acme", planId: plan.id });
    await seedActiveSubscription(company.id, plan.id);
    for (const status of ["PENDING", "IN_PROGRESS", "IN_REVIEW"]) {
      const application = await seedApplication({ name: `App ${status}`, companyId: company.id });
      await seedProject({ name: `Projeto ${status}`, applicationId: application.id, companyId: company.id, status });
    }
    const targetApplication = await seedApplication({ name: "App nova", companyId: company.id });
    const admin = await seedUser({ name: "Admin", email: "admin@vulnera.local", password: PASSWORD, role: "ADMIN" });
    const token = await loginAs(app, admin.email, PASSWORD);

    const res = await request(app)
      .post("/api/projects")
      .set("Authorization", `Bearer ${token}`)
      .send({ applicationId: targetApplication.id, name: "Projeto excedente" });

    expect(res.status).toBe(422);
    expect(res.body.error).toBe("PROJECT_LIMIT_REACHED");
  });

  it("Project COMPLETED não ocupa limite simultâneo, mas continua bloqueando a mesma Application", async () => {
    const plan = await seedPlan({ name: "BASIC", maxProjects: 1 });
    const company = await seedCompany({ name: "Acme", planId: plan.id });
    await seedActiveSubscription(company.id, plan.id);
    const completedApplication = await seedApplication({ name: "App concluída", companyId: company.id });
    await seedProject({
      name: "Projeto concluído",
      applicationId: completedApplication.id,
      companyId: company.id,
      status: "COMPLETED",
    });
    const newApplication = await seedApplication({ name: "App nova", companyId: company.id });
    const admin = await seedUser({ name: "Admin", email: "admin@vulnera.local", password: PASSWORD, role: "ADMIN" });
    const token = await loginAs(app, admin.email, PASSWORD);

    const duplicate = await request(app)
      .post("/api/projects")
      .set("Authorization", `Bearer ${token}`)
      .send({ applicationId: completedApplication.id, name: "Projeto repetido" });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error).toBe("APPLICATION_ALREADY_HAS_PROJECT");

    const next = await request(app)
      .post("/api/projects")
      .set("Authorization", `Bearer ${token}`)
      .send({ applicationId: newApplication.id, name: "Projeto novo" });
    expect(next.status).toBe(201);
  });

  it("só ativa hasRemediation quando o plano ACTIVE inclui o serviço; false continua permitido", async () => {
    const companyPlan = await seedPlan({ name: "COMPANY_PLAN", includesRemediation: true });
    const activePlan = await seedPlan({ name: "ACTIVE_PLAN", includesRemediation: false });
    const company = await seedCompany({ name: "Acme", planId: companyPlan.id });
    await seedActiveSubscription(company.id, activePlan.id);
    const applicationWithRemediation = await seedApplication({ name: "App com remediation", companyId: company.id });
    const applicationWithoutRemediation = await seedApplication({ name: "App sem remediation", companyId: company.id });
    const admin = await seedUser({ name: "Admin", email: "admin@vulnera.local", password: PASSWORD, role: "ADMIN" });
    const token = await loginAs(app, admin.email, PASSWORD);

    const denied = await request(app)
      .post("/api/projects")
      .set("Authorization", `Bearer ${token}`)
      .send({ applicationId: applicationWithRemediation.id, name: "Pedido de remediation", hasRemediation: true });
    expect(denied.status).toBe(422);
    expect(denied.body.error).toBe("REMEDIATION_NOT_INCLUDED");

    const allowed = await request(app)
      .post("/api/projects")
      .set("Authorization", `Bearer ${token}`)
      .send({ applicationId: applicationWithoutRemediation.id, name: "Sem remediation", hasRemediation: false });
    expect(allowed.status).toBe(201);
    expect(allowed.body.hasRemediation).toBe(false);
  });

  it("PUT não contorna a elegibilidade de remediation e deixa desabilitar livremente", async () => {
    const companyPlan = await seedPlan({ name: "COMPANY_PLAN", includesRemediation: true });
    const activePlan = await seedPlan({ name: "ACTIVE_PLAN", includesRemediation: false });
    const includedPlan = await seedPlan({ name: "INCLUDED_PLAN", includesRemediation: true });
    const company = await seedCompany({ name: "Acme", planId: companyPlan.id });
    const subscription = await seedActiveSubscription(company.id, activePlan.id);
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

    const denied = await request(app)
      .put(`/api/projects/${project.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ hasRemediation: true });
    expect(denied.status).toBe(422);
    expect(denied.body.error).toBe("REMEDIATION_NOT_INCLUDED");

    const metadata = await request(app)
      .put(`/api/projects/${project.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ notes: "Metadado sem gate comercial" });
    expect(metadata.status).toBe(200);

    await prisma.subscription.update({ where: { id: subscription.id }, data: { planId: includedPlan.id } });
    const enabled = await request(app)
      .put(`/api/projects/${project.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ hasRemediation: true });
    expect(enabled.status).toBe(200);
    expect(enabled.body.hasRemediation).toBe(true);

    const disabled = await request(app)
      .put(`/api/projects/${project.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ hasRemediation: false });
    expect(disabled.status).toBe(200);
    expect(disabled.body.hasRemediation).toBe(false);
  });

  it("Application inativa é barrada após checar o tenant", async () => {
    const plan = await seedPlan({ name: "BASIC" });
    const companyA = await seedCompany({ name: "Company A", planId: plan.id });
    const companyB = await seedCompany({ name: "Company B", planId: plan.id });
    await seedActiveSubscription(companyA.id, plan.id);
    await seedActiveSubscription(companyB.id, plan.id);
    const ownInactiveApplication = await seedApplication({ name: "App inativa A", companyId: companyA.id, isActive: false });
    const otherInactiveApplication = await seedApplication({ name: "App inativa B", companyId: companyB.id, isActive: false });
    const client = await seedUser({
      name: "Client A",
      email: "clientA@vulnera.local",
      password: PASSWORD,
      role: "CLIENT",
      companyId: companyA.id,
      companyRole: "OWNER",
    });
    const token = await loginAs(app, client.email, PASSWORD);

    const crossTenant = await request(app)
      .post("/api/projects")
      .set("Authorization", `Bearer ${token}`)
      .send({ applicationId: otherInactiveApplication.id, name: "Projeto cross-tenant" });
    expect(crossTenant.status).toBe(403);
    expect(crossTenant.body.error).toBe("FORBIDDEN");

    const inactive = await request(app)
      .post("/api/projects")
      .set("Authorization", `Bearer ${token}`)
      .send({ applicationId: ownInactiveApplication.id, name: "Projeto em app inativa" });
    expect(inactive.status).toBe(422);
    expect(inactive.body.error).toBe("APPLICATION_INACTIVE");
  });

  it("valida os campos de criação antes da regra comercial", async () => {
    const plan = await seedPlan({ name: "BASIC" });
    const company = await seedCompany({ name: "Acme", planId: plan.id });
    const application = await seedApplication({ name: "App 1", companyId: company.id });
    const admin = await seedUser({ name: "Admin", email: "admin@vulnera.local", password: PASSWORD, role: "ADMIN" });
    const token = await loginAs(app, admin.email, PASSWORD);
    const invalidPayloads = [
      [{ name: "Sem aplicação" }, "INVALID_APPLICATION_ID"],
      [{ applicationId: 42, name: "Nome" }, "INVALID_APPLICATION_ID"],
      [{ applicationId: application.id }, "INVALID_NAME"],
      [{ applicationId: application.id, name: "   \t " }, "INVALID_NAME"],
      [{ applicationId: application.id, name: 42 }, "INVALID_NAME"],
      [{ applicationId: application.id, name: "x".repeat(192) }, "INVALID_NAME"],
      [{ applicationId: application.id, name: "Nome", analysisType: "PENTEST" }, "INVALID_ANALYSIS_TYPE"],
      [{ applicationId: application.id, name: "Nome", analysisLevel: "SIMPLE" }, "INVALID_ANALYSIS_LEVEL"],
      [{ applicationId: application.id, name: "Nome", hasRemediation: "true" }, "INVALID_HAS_REMEDIATION"],
    ] as const;

    for (const [payload, error] of invalidPayloads) {
      const res = await request(app)
        .post("/api/projects")
        .set("Authorization", `Bearer ${token}`)
        .send(payload);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe(error);
    }
  });

  it("aceita nome com 191 caracteres e rejeita 192 no POST e no PUT", async () => {
    const plan = await seedPlan({ name: "BASIC" });
    const company = await seedCompany({ name: "Acme", planId: plan.id });
    await seedActiveSubscription(company.id, plan.id);
    const application = await seedApplication({ name: "App 1", companyId: company.id });
    const admin = await seedUser({ name: "Admin", email: "admin@vulnera.local", password: PASSWORD, role: "ADMIN" });
    const token = await loginAs(app, admin.email, PASSWORD);
    const name191 = "n".repeat(191);
    const name192 = "n".repeat(192);

    const tooLongCreate = await request(app)
      .post("/api/projects")
      .set("Authorization", `Bearer ${token}`)
      .send({ applicationId: application.id, name: name192 });
    expect(tooLongCreate.status).toBe(400);
    expect(tooLongCreate.body.error).toBe("INVALID_NAME");

    const created = await request(app)
      .post("/api/projects")
      .set("Authorization", `Bearer ${token}`)
      .send({ applicationId: application.id, name: name191 });
    expect(created.status).toBe(201);
    expect(created.body.name).toHaveLength(191);

    const tooLongUpdate = await request(app)
      .put(`/api/projects/${created.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: name192 });
    expect(tooLongUpdate.status).toBe(400);
    expect(tooLongUpdate.body.error).toBe("INVALID_NAME");

    const acceptedUpdate = await request(app)
      .put(`/api/projects/${created.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: name191 });
    expect(acceptedUpdate.status).toBe(200);
    expect(acceptedUpdate.body.name).toHaveLength(191);
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
    const applicationB = await seedApplication({ name: "App B", companyId: companyB.id });
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

    // TEN-20 — campos extras do body não reatribuem o Project nem alteram seu status.
    const tenantMutation = await request(app)
      .put(`/api/projects/${projectA.id}`)
      .set("Authorization", `Bearer ${clientAToken}`)
      .send({
        applicationId: applicationB.id,
        companyId: companyB.id,
        status: "COMPLETED",
        notes: "Campo permitido segue atualizável",
      });
    expect(tenantMutation.status).toBe(200);
    expect(tenantMutation.body.applicationId).toBe(applicationA.id);
    expect(tenantMutation.body.companyId).toBe(companyA.id);
    expect(tenantMutation.body.status).toBe("PENDING");
    expect(tenantMutation.body.notes).toBe("Campo permitido segue atualizável");
    const persistedProject = await prisma.project.findUnique({ where: { id: projectA.id } });
    expect(persistedProject?.applicationId).toBe(applicationA.id);
    expect(persistedProject?.companyId).toBe(companyA.id);
    expect(persistedProject?.status).toBe("PENDING");

    const renamed = await request(app)
      .put(`/api/projects/${projectA.id}`)
      .set("Authorization", `Bearer ${clientAToken}`)
      .send({ name: "  Nome atualizado  " });
    expect(renamed.status).toBe(200);
    expect(renamed.body.name).toBe("Nome atualizado");

    const blankName = await request(app)
      .put(`/api/projects/${projectA.id}`)
      .set("Authorization", `Bearer ${clientAToken}`)
      .send({ name: "   \t " });
    expect(blankName.status).toBe(400);
    expect(blankName.body.error).toBe("INVALID_NAME");

    const nonStringName = await request(app)
      .put(`/api/projects/${projectA.id}`)
      .set("Authorization", `Bearer ${clientAToken}`)
      .send({ name: 42 });
    expect(nonStringName.status).toBe(400);
    expect(nonStringName.body.error).toBe("INVALID_NAME");

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
