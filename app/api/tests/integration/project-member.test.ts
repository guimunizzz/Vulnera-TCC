import request from "supertest";
import { app } from "../../src/app";
import { cleanDatabase } from "../setup";
import { seedUser } from "../fixtures/users.fixture";
import { seedPlan } from "../fixtures/plans.fixture";
import { seedCompany } from "../fixtures/companies.fixture";
import { seedApplication } from "../fixtures/applications.fixture";
import { seedProject, seedProjectMember } from "../fixtures/projects.fixture";
import { loginAs } from "../fixtures/auth.fixture";

const PASSWORD = "senha12345";

describe("ProjectMember (list/add/remove)", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  // MEMBER-01
  it("GET de membros é visível a quem vê o projeto (CLIENT dono); só ADMIN gerencia (POST/DELETE)", async () => {
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
    const pentester = await seedUser({
      name: "Rafael Barros",
      email: "pentester@vulnera.local",
      password: PASSWORD,
      role: "PENTESTER",
    });

    const clientToken = await loginAs(app, client.email, PASSWORD);
    const pentesterToken = await loginAs(app, pentester.email, PASSWORD);

    // CLIENT dono do projeto pode VER a lista de membros...
    const listAsClient = await request(app)
      .get(`/api/projects/${project.id}/members`)
      .set("Authorization", `Bearer ${clientToken}`);
    expect(listAsClient.status).toBe(200);

    // ...mas não pode gerenciar (adicionar)
    const asClient = await request(app)
      .post(`/api/projects/${project.id}/members`)
      .set("Authorization", `Bearer ${clientToken}`)
      .send({ userId: pentester.id });
    expect(asClient.status).toBe(403);

    // PENTESTER não-membro não vê a lista (RN17 também vale aqui)
    const asPentester = await request(app)
      .get(`/api/projects/${project.id}/members`)
      .set("Authorization", `Bearer ${pentesterToken}`);
    expect(asPentester.status).toBe(403);

    await seedProjectMember(project.id, pentester.id);
    // O nome chega na mesma resposta autorizada; nenhum dado privado do User.
    for (const token of [clientToken, pentesterToken]) {
      const assigned = await request(app)
        .get(`/api/projects/${project.id}/members`)
        .set("Authorization", `Bearer ${token}`);
      expect(assigned.status).toBe(200);
      expect(assigned.body).toHaveLength(1);
      expect(assigned.body[0]).toEqual({
        id: expect.any(String), projectId: project.id, userId: pentester.id,
        userName: "Rafael Barros", createdAt: expect.any(String),
      });
    }
  });

  // MEMBER-02
  it("ADMIN atribui PENTESTER; alvo não-pentester retorna 400; par duplicado retorna 409", async () => {
    const plan = await seedPlan({ name: "BASIC" });
    const company = await seedCompany({ name: "Acme", planId: plan.id });
    const application = await seedApplication({ name: "App 1", companyId: company.id });
    const project = await seedProject({ name: "Projeto 1", applicationId: application.id, companyId: company.id });
    const admin = await seedUser({ name: "Admin", email: "admin@vulnera.local", password: PASSWORD, role: "ADMIN" });
    const pentester = await seedUser({
      name: "Pentester",
      email: "pentester@vulnera.local",
      password: PASSWORD,
      role: "PENTESTER",
    });
    const client = await seedUser({ name: "Client", email: "client@vulnera.local", password: PASSWORD, role: "CLIENT" });
    const token = await loginAs(app, admin.email, PASSWORD);

    const notPentester = await request(app)
      .post(`/api/projects/${project.id}/members`)
      .set("Authorization", `Bearer ${token}`)
      .send({ userId: client.id });
    expect(notPentester.status).toBe(400);
    expect(notPentester.body.error).toBe("USER_NOT_PENTESTER");

    const added = await request(app)
      .post(`/api/projects/${project.id}/members`)
      .set("Authorization", `Bearer ${token}`)
      .send({ userId: pentester.id });
    expect(added.status).toBe(201);
    expect(added.body).toEqual({
      id: expect.any(String), projectId: project.id, userId: pentester.id,
      userName: pentester.name, createdAt: expect.any(String),
    });

    const duplicate = await request(app)
      .post(`/api/projects/${project.id}/members`)
      .set("Authorization", `Bearer ${token}`)
      .send({ userId: pentester.id });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error).toBe("MEMBER_ALREADY_EXISTS");

    const list = await request(app)
      .get(`/api/projects/${project.id}/members`)
      .set("Authorization", `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0]).toEqual(added.body);
  });

  // MEMBER-03
  it("ADMIN remove membro; remover quem não é membro retorna 404", async () => {
    const plan = await seedPlan({ name: "BASIC" });
    const company = await seedCompany({ name: "Acme", planId: plan.id });
    const application = await seedApplication({ name: "App 1", companyId: company.id });
    const project = await seedProject({ name: "Projeto 1", applicationId: application.id, companyId: company.id });
    const admin = await seedUser({ name: "Admin", email: "admin@vulnera.local", password: PASSWORD, role: "ADMIN" });
    const pentester = await seedUser({
      name: "Pentester",
      email: "pentester@vulnera.local",
      password: PASSWORD,
      role: "PENTESTER",
    });
    const token = await loginAs(app, admin.email, PASSWORD);

    await seedProjectMember(project.id, pentester.id);

    const removed = await request(app)
      .delete(`/api/projects/${project.id}/members/${pentester.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(removed.status).toBe(204);

    const removeAgain = await request(app)
      .delete(`/api/projects/${project.id}/members/${pentester.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(removeAgain.status).toBe(404);
    expect(removeAgain.body.error).toBe("MEMBER_NOT_FOUND");
  });

  // TEN-MEMBER-01 — incluir nomes não pode liberar a lista de outra Company.
  it("CLIENT de outra Company não recebe os nomes dos pentesters atribuídos", async () => {
    const plan = await seedPlan({ name: "BASIC" });
    const companyA = await seedCompany({ name: "Company A", planId: plan.id });
    const companyB = await seedCompany({ name: "Company B", planId: plan.id });
    const application = await seedApplication({ name: "Portal A", companyId: companyA.id });
    const project = await seedProject({ name: "Projeto A", applicationId: application.id, companyId: companyA.id });
    const pentester = await seedUser({ name: "Nome privado do projeto A", email: "pentester-a@example.test", password: PASSWORD, role: "PENTESTER" });
    await seedProjectMember(project.id, pentester.id);
    const clientB = await seedUser({ name: "Cliente B", email: "client-b@example.test", password: PASSWORD, role: "CLIENT", companyId: companyB.id, companyRole: "OWNER" });
    const token = await loginAs(app, clientB.email, PASSWORD);
    const response = await request(app).get(`/api/projects/${project.id}/members`).set("Authorization", `Bearer ${token}`);
    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: "FORBIDDEN" });
  });
});
