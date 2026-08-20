import request from "supertest";
import { app } from "../../src/app";
import { cleanDatabase } from "../setup";
import { prisma } from "../../src/database/prisma.database";
import { seedUser } from "../fixtures/users.fixture";
import { seedPlan } from "../fixtures/plans.fixture";
import { seedCompany } from "../fixtures/companies.fixture";
import { loginAs } from "../fixtures/auth.fixture";

const PASSWORD = "senha12345";

describe("Company (me/list/getById/create/update/delete)", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  // COMP-01
  it("POST /api/companies: quem cria vira dono (User.companyId + companyRole=OWNER)", async () => {
    const plan = await seedPlan({ name: "BASIC" });
    const client = await seedUser({ name: "Client", email: "client@vulnera.local", password: PASSWORD, role: "CLIENT" });
    const token = await loginAs(app, client.email, PASSWORD);

    const res = await request(app)
      .post("/api/companies")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Acme Ltda", planId: plan.id });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Acme Ltda");

    const updatedUser = await prisma.user.findUnique({ where: { id: client.id } });
    expect(updatedUser?.companyId).toBe(res.body.id);
    expect(updatedUser?.companyRole).toBe("OWNER");

    const me = await request(app).get("/api/companies/me").set("Authorization", `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect(me.body.id).toBe(res.body.id);
  });

  // COMP-02
  it("POST /api/companies: quem já tem empresa não pode criar outra (409)", async () => {
    const plan = await seedPlan({ name: "BASIC" });
    const company = await seedCompany({ name: "Existing Co", planId: plan.id });
    const client = await seedUser({
      name: "Owner",
      email: "owner@vulnera.local",
      password: PASSWORD,
      role: "CLIENT",
      companyId: company.id,
      companyRole: "OWNER",
    });
    const token = await loginAs(app, client.email, PASSWORD);

    const res = await request(app)
      .post("/api/companies")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Second Co", planId: plan.id });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe("USER_ALREADY_HAS_COMPANY");
  });

  // COMP-03
  it("POST /api/companies valida formato de CNPJ (400) e unicidade (409)", async () => {
    const plan = await seedPlan({ name: "BASIC" });
    const client = await seedUser({ name: "Client", email: "client@vulnera.local", password: PASSWORD, role: "CLIENT" });
    const token = await loginAs(app, client.email, PASSWORD);

    const invalidFormat = await request(app)
      .post("/api/companies")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Acme", cnpj: "123", planId: plan.id });
    expect(invalidFormat.status).toBe(400);
    expect(invalidFormat.body.error).toBe("INVALID_CNPJ");

    await seedCompany({ name: "Taken Co", cnpj: "12345678000199", planId: plan.id });

    const duplicateCnpj = await request(app)
      .post("/api/companies")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Acme", cnpj: "12345678000199", planId: plan.id });
    expect(duplicateCnpj.status).toBe(409);
    expect(duplicateCnpj.body.error).toBe("COMPANY_ALREADY_EXISTS");
  });

  // COMP-04
  it("GET /api/companies/me sem empresa retorna 404 USER_HAS_NO_COMPANY", async () => {
    const client = await seedUser({ name: "Client", email: "client@vulnera.local", password: PASSWORD, role: "CLIENT" });
    const token = await loginAs(app, client.email, PASSWORD);

    const res = await request(app).get("/api/companies/me").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("USER_HAS_NO_COMPANY");
  });

  // COMP-05 / TEN-01
  it("GET /api/companies (list) e GET /:id são admin-only — CLIENT não vê catálogo de empresas alheias", async () => {
    const admin = await seedUser({ name: "Admin", email: "admin@vulnera.local", password: PASSWORD, role: "ADMIN" });
    const plan = await seedPlan({ name: "BASIC" });
    const companyA = await seedCompany({ name: "Company A", planId: plan.id });
    const companyB = await seedCompany({ name: "Company B", planId: plan.id });
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

    const listAsAdmin = await request(app).get("/api/companies").set("Authorization", `Bearer ${adminToken}`);
    expect(listAsAdmin.status).toBe(200);
    expect(listAsAdmin.body).toHaveLength(2);

    const listAsClient = await request(app).get("/api/companies").set("Authorization", `Bearer ${clientAToken}`);
    expect(listAsClient.status).toBe(403);
    expect(listAsClient.body.error).toBe("FORBIDDEN");

    const getCompanyBAsClientA = await request(app)
      .get(`/api/companies/${companyB.id}`)
      .set("Authorization", `Bearer ${clientAToken}`);
    expect(getCompanyBAsClientA.status).toBe(403);
  });

  // COMP-06 / TEN-02
  it("PUT /api/companies/:id: CLIENT só edita a própria empresa, ADMIN edita qualquer uma", async () => {
    const admin = await seedUser({ name: "Admin", email: "admin@vulnera.local", password: PASSWORD, role: "ADMIN" });
    const planA = await seedPlan({ name: "BASIC" });
    const planB = await seedPlan({ name: "PRO" });
    const companyA = await seedCompany({ name: "Company A", planId: planA.id });
    const companyB = await seedCompany({ name: "Company B", planId: planA.id });
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

    // CLIENT edita a própria empresa
    const updateOwn = await request(app)
      .put(`/api/companies/${companyA.id}`)
      .set("Authorization", `Bearer ${clientAToken}`)
      .send({ name: "Company A Renamed" });
    expect(updateOwn.status).toBe(200);
    expect(updateOwn.body.name).toBe("Company A Renamed");

    // CLIENT não edita empresa alheia — canário de tenancy
    const updateOther = await request(app)
      .put(`/api/companies/${companyB.id}`)
      .set("Authorization", `Bearer ${clientAToken}`)
      .send({ name: "Hack" });
    expect(updateOther.status).toBe(403);
    expect(updateOther.body.error).toBe("FORBIDDEN");

    // ADMIN edita qualquer empresa, inclusive trocando o plano
    const updateAsAdmin = await request(app)
      .put(`/api/companies/${companyB.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ planId: planB.id });
    expect(updateAsAdmin.status).toBe(200);
    expect(updateAsAdmin.body.planId).toBe(planB.id);
  });

  // COMP-07
  it("DELETE /api/companies/:id é admin-only", async () => {
    const admin = await seedUser({ name: "Admin", email: "admin@vulnera.local", password: PASSWORD, role: "ADMIN" });
    const client = await seedUser({ name: "Client", email: "client@vulnera.local", password: PASSWORD, role: "CLIENT" });
    const plan = await seedPlan({ name: "BASIC" });
    const company = await seedCompany({ name: "Deletable Co", planId: plan.id });

    const adminToken = await loginAs(app, admin.email, PASSWORD);
    const clientToken = await loginAs(app, client.email, PASSWORD);

    const deleteAsClient = await request(app)
      .delete(`/api/companies/${company.id}`)
      .set("Authorization", `Bearer ${clientToken}`);
    expect(deleteAsClient.status).toBe(403);

    const deleteAsAdmin = await request(app)
      .delete(`/api/companies/${company.id}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(deleteAsAdmin.status).toBe(204);
  });
});
