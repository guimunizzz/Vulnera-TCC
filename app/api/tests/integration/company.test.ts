import request from "supertest";
import { app } from "../../src/app";
import { cleanDatabase } from "../setup";
import { prisma } from "../../src/database/prisma.database";
import { seedUser } from "../fixtures/users.fixture";
import { seedPlan } from "../fixtures/plans.fixture";
import { seedCompany } from "../fixtures/companies.fixture";
import { loginAs } from "../fixtures/auth.fixture";
import { CompanyRepository } from "../../src/repositories/company.repository";

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

  // QA-01 / TEN-COMPANY-DTO — um cast TypeScript não pode liberar escrita Prisma aninhada.
  it("PUT Company rejeita escrita aninhada de usuário sem alterar empresa ou identidade", async () => {
    const plan = await seedPlan({ name: "BASIC" });
    const company = await seedCompany({ name: "Empresa original", planId: plan.id });
    const owner = await seedUser({
      name: "Responsável original", email: "qa-company-owner@vulnera.local", password: PASSWORD,
      role: "CLIENT", companyId: company.id, companyRole: "OWNER",
    });
    const token = await loginAs(app, owner.email, PASSWORD);
    const response = await request(app)
      .put(`/api/companies/${company.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Empresa adulterada",
        users: { update: { where: { id: owner.id }, data: { name: "Nome via relação indevida" } } },
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("INVALID_COMPANY_FIELD");
    expect(await prisma.company.findUnique({ where: { id: company.id } })).toEqual(company);
    expect(await prisma.user.findUnique({ where: { id: owner.id } })).toEqual(owner);
  });

  it("PUT Company recusa relações alternativas e campos gerenciados pelo sistema", async () => {
    const plan = await seedPlan({ name: "BASIC" });
    const company = await seedCompany({ name: "Empresa QA", planId: plan.id });
    const owner = await seedUser({
      name: "Responsável QA", email: "qa-company-fields@vulnera.local", password: PASSWORD,
      role: "CLIENT", companyId: company.id, companyRole: "OWNER",
    });
    const token = await loginAs(app, owner.email, PASSWORD);
    const payloads = [
      { users: { updateMany: [{ where: { id: owner.id }, data: { role: "ADMIN" } }] } },
      { users: { connect: [{ id: owner.id }] } },
      { subscriptions: { create: { planId: plan.id } } },
      { plan: { connect: { id: plan.id } } },
      { id: "company-id-adulterado" },
      { createdAt: "2000-01-01T00:00:00.000Z" },
      JSON.parse('{"__proto__":{"users":{"deleteMany":{}}}}'),
    ];

    for (const payload of payloads) {
      const response = await request(app)
        .put(`/api/companies/${company.id}`)
        .set("Authorization", `Bearer ${token}`)
        // JSON cru preserva __proto__ como chave própria até o parser HTTP.
        .set("Content-Type", "application/json")
        .send(JSON.stringify(payload));
      expect(response.status).toBe(400);
      expect(response.body.error).toBe("INVALID_COMPANY_FIELD");
    }
    expect(await prisma.company.findUnique({ where: { id: company.id } })).toEqual(company);
    expect(await prisma.user.findUnique({ where: { id: owner.id } })).toEqual(owner);
    expect(await prisma.subscription.count({ where: { companyId: company.id } })).toBe(0);
  });

  it("PUT Company valida escalares sem aceitar operações Prisma ou coerção de CNPJ", async () => {
    const plan = await seedPlan({ name: "BASIC" });
    const company = await seedCompany({ name: "Empresa QA", planId: plan.id });
    const owner = await seedUser({
      name: "Responsável QA", email: "qa-company-types@vulnera.local", password: PASSWORD,
      role: "CLIENT", companyId: company.id, companyRole: "OWNER",
    });
    const token = await loginAs(app, owner.email, PASSWORD);
    const cases = [
      { body: { name: { set: "Nome indevido" } }, error: "INVALID_NAME" },
      { body: { planId: { set: plan.id } }, error: "INVALID_PLAN_ID" },
      { body: { cnpj: { set: "12345678000199" } }, error: "INVALID_CNPJ" },
      { body: { cnpj: ["12345678000199"] }, error: "INVALID_CNPJ" },
      { body: { cnpj: 12345678000199 }, error: "INVALID_CNPJ" },
      { body: [{ name: "Nome em array" }], error: "INVALID_BODY" },
    ];
    for (const scenario of cases) {
      const response = await request(app)
        .put(`/api/companies/${company.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send(scenario.body);
      expect(response.status).toBe(400);
      expect(response.body.error).toBe(scenario.error);
    }
    expect(await prisma.company.findUnique({ where: { id: company.id } })).toEqual(company);
  });

  it("PUT Company preserva atualização legítima parcial e completa dos três campos", async () => {
    const plan = await seedPlan({ name: "BASIC" });
    const nextPlan = await seedPlan({ name: "PRO" });
    const company = await seedCompany({ name: "Empresa QA", cnpj: "12345678000199", planId: plan.id });
    const owner = await seedUser({
      name: "Responsável QA", email: "qa-company-control@vulnera.local", password: PASSWORD,
      role: "CLIENT", companyId: company.id, companyRole: "OWNER",
    });
    const token = await loginAs(app, owner.email, PASSWORD);
    const partial = await request(app).put(`/api/companies/${company.id}`)
      .set("Authorization", `Bearer ${token}`).send({ name: "Empresa renomeada" });
    expect(partial.status).toBe(200);
    expect(partial.body).toMatchObject({ name: "Empresa renomeada", cnpj: company.cnpj, planId: plan.id });

    const complete = await request(app).put(`/api/companies/${company.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Empresa atualizada", cnpj: "98.765.432/0001-00", planId: nextPlan.id });
    expect(complete.status).toBe(200);
    expect(complete.body).toMatchObject({ name: "Empresa atualizada", cnpj: "98.765.432/0001-00", planId: nextPlan.id });
    expect(await prisma.user.findUnique({ where: { id: owner.id } })).toEqual(owner);
  });

  it("CompanyRepository mantém relações e identidade fora do contrato mesmo em chamada interna", async () => {
    const plan = await seedPlan({ name: "BASIC" });
    const company = await seedCompany({ name: "Empresa QA", planId: plan.id });
    const owner = await seedUser({
      name: "Responsável QA", email: "qa-company-repository@vulnera.local", password: PASSWORD,
      role: "CLIENT", companyId: company.id, companyRole: "OWNER",
    });
    // Uma futura chamada interna não pode voltar a expor o input genérico do Prisma.
    const contaminated = {
      name: "Atualização permitida", id: "id-fora-do-contrato", createdAt: new Date(0),
      users: { updateMany: { where: { id: owner.id }, data: { name: "Escrita aninhada indevida" } } },
    };
    const updated = await new CompanyRepository(prisma).update(company.id, contaminated);
    expect(updated).toMatchObject({ id: company.id, name: "Atualização permitida", createdAt: company.createdAt });
    expect(await prisma.user.findUnique({ where: { id: owner.id } })).toEqual(owner);
  });
});
