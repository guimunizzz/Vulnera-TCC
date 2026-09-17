import request from "supertest";
import { app } from "../../src/app";
import { cleanDatabase } from "../setup";
import { seedUser } from "../fixtures/users.fixture";
import { seedPlan } from "../fixtures/plans.fixture";
import { seedCompany } from "../fixtures/companies.fixture";
import { seedSubscription } from "../fixtures/subscriptions.fixture";
import { seedApplication } from "../fixtures/applications.fixture";
import { loginAs } from "../fixtures/auth.fixture";

const PASSWORD = "senha12345";

describe("Application (list/getById/create/update/delete)", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  // APP-01
  it("POST /api/applications sem subscription ativa retorna 422 NO_ACTIVE_SUBSCRIPTION", async () => {
    const plan = await seedPlan({ name: "BASIC", maxApplications: 2 });
    const company = await seedCompany({ name: "Acme", planId: plan.id });
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
      .post("/api/applications")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "App 1", url: "https://app1.acme.com" });

    expect(res.status).toBe(422);
    expect(res.body.error).toBe("NO_ACTIVE_SUBSCRIPTION");
  });

  // APP-02
  it("POST /api/applications estoura o limite do plano BASIC (422 PLAN_LIMIT_REACHED)", async () => {
    const plan = await seedPlan({ name: "BASIC", maxApplications: 2 });
    const company = await seedCompany({ name: "Acme", planId: plan.id });
    await seedSubscription({ companyId: company.id, planId: plan.id, status: "ACTIVE", startDate: new Date() });
    const client = await seedUser({
      name: "Client",
      email: "client@vulnera.local",
      password: PASSWORD,
      role: "CLIENT",
      companyId: company.id,
      companyRole: "OWNER",
    });
    const token = await loginAs(app, client.email, PASSWORD);

    const first = await request(app)
      .post("/api/applications")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "App 1", url: "https://app1.acme.com" });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post("/api/applications")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "App 2", url: "https://app2.acme.com" });
    expect(second.status).toBe(201);

    const third = await request(app)
      .post("/api/applications")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "App 3", url: "https://app3.acme.com" });
    expect(third.status).toBe(422);
    expect(third.body.error).toBe("PLAN_LIMIT_REACHED");
  });

  // APP-03
  it("POST /api/applications: URL inválida 400; companyId enviado no body é ignorado (usa o do actor)", async () => {
    const plan = await seedPlan({ name: "BASIC", maxApplications: 2 });
    const company = await seedCompany({ name: "Acme", planId: plan.id });
    const otherCompany = await seedCompany({ name: "Other Co", planId: plan.id });
    await seedSubscription({ companyId: company.id, planId: plan.id, status: "ACTIVE", startDate: new Date() });
    const client = await seedUser({
      name: "Client",
      email: "client@vulnera.local",
      password: PASSWORD,
      role: "CLIENT",
      companyId: company.id,
      companyRole: "OWNER",
    });
    const token = await loginAs(app, client.email, PASSWORD);

    const invalidUrl = await request(app)
      .post("/api/applications")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "App 1", url: "not-a-url" });
    expect(invalidUrl.status).toBe(400);
    expect(invalidUrl.body.error).toBe("INVALID_URL");

    const res = await request(app)
      .post("/api/applications")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "App 1", url: "https://app1.acme.com", companyId: otherCompany.id });
    expect(res.status).toBe(201);
    expect(res.body.companyId).toBe(company.id);
  });

  it("POST /api/applications: ADMIN global cria na companyId enviada e devolve o ID alvo", async () => {
    const plan = await seedPlan({ name: "BASIC", maxApplications: 2 });
    const company = await seedCompany({ name: "Target Co", planId: plan.id });
    await seedSubscription({ companyId: company.id, planId: plan.id, status: "ACTIVE", startDate: new Date() });
    const admin = await seedUser({
      name: "Global Admin",
      email: "global-admin-create@vulnera.local",
      password: PASSWORD,
      role: "ADMIN",
    });
    const token = await loginAs(app, admin.email, PASSWORD);

    const res = await request(app)
      .post("/api/applications")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Target App", url: "https://target.example.com", companyId: company.id });

    expect(res.status).toBe(201);
    expect(res.body.companyId).toBe(company.id);
  });

  it("POST /api/applications: ADMIN global sem companyId recebe 400 MISSING_COMPANY_ID", async () => {
    const admin = await seedUser({
      name: "Global Admin",
      email: "global-admin-missing-company@vulnera.local",
      password: PASSWORD,
      role: "ADMIN",
    });
    const token = await loginAs(app, admin.email, PASSWORD);

    const res = await request(app)
      .post("/api/applications")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Missing Context App", url: "https://missing-context.example.com" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("MISSING_COMPANY_ID");
  });

  it("POST /api/applications: ADMIN global com companyId inexistente recebe 404 COMPANY_NOT_FOUND", async () => {
    const admin = await seedUser({
      name: "Global Admin",
      email: "global-admin-unknown-company@vulnera.local",
      password: PASSWORD,
      role: "ADMIN",
    });
    const token = await loginAs(app, admin.email, PASSWORD);

    const res = await request(app)
      .post("/api/applications")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Unknown Context App",
        url: "https://unknown-context.example.com",
        companyId: "company-inexistente",
      });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("COMPANY_NOT_FOUND");
  });

  it("POST /api/applications: CLIENT sem companyId cria na própria company", async () => {
    const plan = await seedPlan({ name: "BASIC", maxApplications: 2 });
    const company = await seedCompany({ name: "Client Co", planId: plan.id });
    await seedSubscription({ companyId: company.id, planId: plan.id, status: "ACTIVE", startDate: new Date() });
    const client = await seedUser({
      name: "Client",
      email: "client-own-company@vulnera.local",
      password: PASSWORD,
      role: "CLIENT",
      companyId: company.id,
      companyRole: "OWNER",
    });
    const token = await loginAs(app, client.email, PASSWORD);

    const res = await request(app)
      .post("/api/applications")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Own Company App", url: "https://own-company.example.com" });

    expect(res.status).toBe(201);
    expect(res.body.companyId).toBe(company.id);
  });

  it("POST /api/applications: CLIENT sem company recebe 404 USER_HAS_NO_COMPANY", async () => {
    const client = await seedUser({
      name: "Unassigned Client",
      email: "client-without-company@vulnera.local",
      password: PASSWORD,
      role: "CLIENT",
    });
    const token = await loginAs(app, client.email, PASSWORD);

    const res = await request(app)
      .post("/api/applications")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Unassigned App", url: "https://unassigned.example.com" });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("USER_HAS_NO_COMPANY");
  });

  it("POST /api/applications: PENTESTER sem company recebe 403 FORBIDDEN", async () => {
    const pentester = await seedUser({
      name: "Unassigned Pentester",
      email: "pentester-without-company@vulnera.local",
      password: PASSWORD,
      role: "PENTESTER",
    });
    const token = await loginAs(app, pentester.email, PASSWORD);

    const res = await request(app)
      .post("/api/applications")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Pentester App", url: "https://pentester.example.com" });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("FORBIDDEN");
  });

  it("POST /api/applications: PENTESTER com company ativa recebe 403 FORBIDDEN", async () => {
    const plan = await seedPlan({ name: "BASIC", maxApplications: 2 });
    const company = await seedCompany({ name: "Pentest Co", planId: plan.id });
    await seedSubscription({ companyId: company.id, planId: plan.id, status: "ACTIVE", startDate: new Date() });
    const pentester = await seedUser({
      name: "Assigned Pentester",
      email: "pentester-with-company@vulnera.local",
      password: PASSWORD,
      role: "PENTESTER",
      companyId: company.id,
    });
    const token = await loginAs(app, pentester.email, PASSWORD);

    const res = await request(app)
      .post("/api/applications")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Pentester App", url: "https://pentester-company.example.com" });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("FORBIDDEN");
  });

  it("POST /api/applications: ADMIN global sem subscription ativa recebe 422 NO_ACTIVE_SUBSCRIPTION", async () => {
    const plan = await seedPlan({ name: "BASIC", maxApplications: 2 });
    const company = await seedCompany({ name: "No Subscription Co", planId: plan.id });
    const admin = await seedUser({
      name: "Global Admin",
      email: "global-admin-no-subscription@vulnera.local",
      password: PASSWORD,
      role: "ADMIN",
    });
    const token = await loginAs(app, admin.email, PASSWORD);

    const res = await request(app)
      .post("/api/applications")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "No Subscription App", url: "https://no-subscription.example.com", companyId: company.id });

    expect(res.status).toBe(422);
    expect(res.body.error).toBe("NO_ACTIVE_SUBSCRIPTION");
  });

  it("POST /api/applications: ADMIN global em company no limite recebe 422 PLAN_LIMIT_REACHED", async () => {
    const plan = await seedPlan({ name: "BASIC", maxApplications: 1 });
    const company = await seedCompany({ name: "Full Co", planId: plan.id });
    await seedSubscription({ companyId: company.id, planId: plan.id, status: "ACTIVE", startDate: new Date() });
    await seedApplication({ name: "Existing App", companyId: company.id, url: "https://existing.example.com" });
    const admin = await seedUser({
      name: "Global Admin",
      email: "global-admin-plan-limit@vulnera.local",
      password: PASSWORD,
      role: "ADMIN",
    });
    const token = await loginAs(app, admin.email, PASSWORD);

    const res = await request(app)
      .post("/api/applications")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Full Company App", url: "https://full-company.example.com", companyId: company.id });

    expect(res.status).toBe(422);
    expect(res.body.error).toBe("PLAN_LIMIT_REACHED");
  });

  // APP-04
  it("DELETE faz soft delete (isActive=false), some da listagem e libera vaga no limite do plano", async () => {
    const plan = await seedPlan({ name: "BASIC", maxApplications: 1 });
    const company = await seedCompany({ name: "Acme", planId: plan.id });
    await seedSubscription({ companyId: company.id, planId: plan.id, status: "ACTIVE", startDate: new Date() });
    const client = await seedUser({
      name: "Client",
      email: "client@vulnera.local",
      password: PASSWORD,
      role: "CLIENT",
      companyId: company.id,
      companyRole: "OWNER",
    });
    const token = await loginAs(app, client.email, PASSWORD);

    const created = await request(app)
      .post("/api/applications")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "App 1", url: "https://app1.acme.com" });
    expect(created.status).toBe(201);

    const blocked = await request(app)
      .post("/api/applications")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "App 2", url: "https://app2.acme.com" });
    expect(blocked.status).toBe(422);

    const del = await request(app)
      .delete(`/api/applications/${created.body.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(del.status).toBe(204);

    const list = await request(app).get("/api/applications").set("Authorization", `Bearer ${token}`);
    expect(list.body).toHaveLength(0);

    const after = await request(app)
      .post("/api/applications")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "App 2", url: "https://app2.acme.com" });
    expect(after.status).toBe(201);
  });

  // TEN-01 / TEN-02
  it("Isolamento: CLIENT só vê/edita applications da própria company; ADMIN vê todas", async () => {
    const plan = await seedPlan({ name: "BASIC", maxApplications: 5 });
    const companyA = await seedCompany({ name: "Company A", planId: plan.id });
    const companyB = await seedCompany({ name: "Company B", planId: plan.id });
    const appA = await seedApplication({ name: "App A", companyId: companyA.id });
    const appB = await seedApplication({ name: "App B", companyId: companyB.id });

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

    const listAsClientA = await request(app).get("/api/applications").set("Authorization", `Bearer ${clientAToken}`);
    expect(listAsClientA.status).toBe(200);
    expect(listAsClientA.body).toHaveLength(1);
    expect(listAsClientA.body[0].id).toBe(appA.id);

    const getAppBAsClientA = await request(app)
      .get(`/api/applications/${appB.id}`)
      .set("Authorization", `Bearer ${clientAToken}`);
    expect(getAppBAsClientA.status).toBe(403);

    const listAsAdmin = await request(app).get("/api/applications").set("Authorization", `Bearer ${adminToken}`);
    expect(listAsAdmin.status).toBe(200);
    expect(listAsAdmin.body).toHaveLength(2);
  });

  // TEN-03
  it("PENTESTER não gerencia applications diretamente (403 na listagem)", async () => {
    const pentester = await seedUser({
      name: "Pentester",
      email: "pentester@vulnera.local",
      password: PASSWORD,
      role: "PENTESTER",
    });
    const token = await loginAs(app, pentester.email, PASSWORD);

    const list = await request(app).get("/api/applications").set("Authorization", `Bearer ${token}`);
    expect(list.status).toBe(403);
    expect(list.body.error).toBe("FORBIDDEN");
  });
});
