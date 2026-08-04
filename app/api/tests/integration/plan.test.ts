import request from "supertest";
import { app } from "../../src/app";
import { cleanDatabase } from "../setup";
import { seedUser } from "../fixtures/users.fixture";
import { seedPlan } from "../fixtures/plans.fixture";
import { loginAs } from "../fixtures/auth.fixture";

const PASSWORD = "senha12345";

describe("Plan (list/getById/create/update/delete)", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  // PLAN-01
  it("GET /api/plans e GET /api/plans/:id são públicos (sem token)", async () => {
    const plan = await seedPlan({ name: "BASIC" });

    const list = await request(app).get("/api/plans");
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);

    const byId = await request(app).get(`/api/plans/${plan.id}`);
    expect(byId.status).toBe(200);
    expect(byId.body.name).toBe("BASIC");

    const notFound = await request(app).get("/api/plans/inexistente");
    expect(notFound.status).toBe(404);
    expect(notFound.body.error).toBe("PLAN_NOT_FOUND");
  });

  // PLAN-02
  it("POST/PUT/DELETE exigem ADMIN — sem token 401, como CLIENT 403", async () => {
    const plan = await seedPlan({ name: "BASIC" });
    const client = await seedUser({ name: "Client", email: "client@vulnera.local", password: PASSWORD, role: "CLIENT" });
    const clientToken = await loginAs(app, client.email, PASSWORD);
    const body = { name: "PRO", maxApplications: 5, maxProjects: 3, includesRemediation: true, price: 100 };

    const createNoAuth = await request(app).post("/api/plans").send(body);
    expect(createNoAuth.status).toBe(401);
    expect(createNoAuth.body.code).toBe("UNAUTHORIZED");

    const createAsClient = await request(app)
      .post("/api/plans")
      .set("Authorization", `Bearer ${clientToken}`)
      .send(body);
    expect(createAsClient.status).toBe(403);
    expect(createAsClient.body.error).toBe("FORBIDDEN");

    const updateAsClient = await request(app)
      .put(`/api/plans/${plan.id}`)
      .set("Authorization", `Bearer ${clientToken}`)
      .send({ price: 999 });
    expect(updateAsClient.status).toBe(403);

    const deleteAsClient = await request(app)
      .delete(`/api/plans/${plan.id}`)
      .set("Authorization", `Bearer ${clientToken}`);
    expect(deleteAsClient.status).toBe(403);
  });

  // PLAN-03
  it("ADMIN cria plano válido (201), rejeita nome duplicado (409) e campos inválidos (400)", async () => {
    const admin = await seedUser({ name: "Admin", email: "admin@vulnera.local", password: PASSWORD, role: "ADMIN" });
    const adminToken = await loginAs(app, admin.email, PASSWORD);
    const validBody = { name: "PRO", maxApplications: 5, maxProjects: 3, includesRemediation: true, price: 1499 };

    const created = await request(app)
      .post("/api/plans")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(validBody);
    expect(created.status).toBe(201);
    expect(created.body.name).toBe("PRO");

    // regra de negócio do service: nome único
    const duplicate = await request(app)
      .post("/api/plans")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(validBody);
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error).toBe("PLAN_ALREADY_EXISTS");

    // validação do controller
    const invalidMaxApps = await request(app)
      .post("/api/plans")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ ...validBody, name: "Enterprise", maxApplications: 0 });
    expect(invalidMaxApps.status).toBe(400);
    expect(invalidMaxApps.body.error).toBe("INVALID_MAX_APPLICATIONS");
  });

  // PLAN-04
  it("ADMIN atualiza e deleta plano; renomear pra nome já usado por outro plano retorna 409", async () => {
    const admin = await seedUser({ name: "Admin", email: "admin@vulnera.local", password: PASSWORD, role: "ADMIN" });
    const adminToken = await loginAs(app, admin.email, PASSWORD);
    const planA = await seedPlan({ name: "BASIC" });
    const planB = await seedPlan({ name: "PRO" });

    const update = await request(app)
      .put(`/api/plans/${planA.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ price: 599 });
    expect(update.status).toBe(200);
    expect(update.body.price).toBe(599);

    const renameToTaken = await request(app)
      .put(`/api/plans/${planA.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "PRO" });
    expect(renameToTaken.status).toBe(409);
    expect(renameToTaken.body.error).toBe("PLAN_ALREADY_EXISTS");

    const del = await request(app).delete(`/api/plans/${planB.id}`).set("Authorization", `Bearer ${adminToken}`);
    expect(del.status).toBe(204);

    const getDeleted = await request(app).get(`/api/plans/${planB.id}`);
    expect(getDeleted.status).toBe(404);
  });
});
