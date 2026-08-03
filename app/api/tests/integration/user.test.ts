import request from "supertest";
import { app } from "../../src/app";
import { cleanDatabase } from "../setup";
import { seedUser } from "../fixtures/users.fixture";
import { loginAs } from "../fixtures/auth.fixture";

const PASSWORD = "senha12345";

describe("User (me/list/getById/update/delete)", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  // USR-01
  it("GET /api/users/me retorna o usuário autenticado sem expor a senha", async () => {
    const user = await seedUser({
      name: "Self User",
      email: "self@vulnera.local",
      password: PASSWORD,
      role: "CLIENT",
    });
    const token = await loginAs(app, user.email, PASSWORD);

    const res = await request(app).get("/api/users/me").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: user.id, email: user.email, role: "CLIENT" });
    expect(res.body.password).toBeUndefined();
  });

  // USR-02
  it("regras de visibilidade por role: ADMIN vê todos, CLIENT sem company não vê outro CLIENT sem company, PENTESTER só vê a si mesmo", async () => {
    const admin = await seedUser({ name: "Admin", email: "admin@vulnera.local", password: PASSWORD, role: "ADMIN" });
    const clientA = await seedUser({ name: "Client A", email: "clientA@vulnera.local", password: PASSWORD, role: "CLIENT" });
    const clientB = await seedUser({ name: "Client B", email: "clientB@vulnera.local", password: PASSWORD, role: "CLIENT" });
    const pentester = await seedUser({ name: "Pentester", email: "pentester@vulnera.local", password: PASSWORD, role: "PENTESTER" });

    const adminToken = await loginAs(app, admin.email, PASSWORD);
    const clientAToken = await loginAs(app, clientA.email, PASSWORD);
    const pentesterToken = await loginAs(app, pentester.email, PASSWORD);

    // ADMIN vê todos
    const listAsAdmin = await request(app).get("/api/users").set("Authorization", `Bearer ${adminToken}`);
    expect(listAsAdmin.status).toBe(200);
    expect(listAsAdmin.body).toHaveLength(4);

    // CLIENT sem company não pode ver outro CLIENT também sem company (regressão: null !== null)
    const getOtherByClient = await request(app)
      .get(`/api/users/${clientB.id}`)
      .set("Authorization", `Bearer ${clientAToken}`);
    expect(getOtherByClient.status).toBe(403);
    expect(getOtherByClient.body.code).toBe("FORBIDDEN");

    // mas pode ver a si mesmo
    const getSelfByClient = await request(app)
      .get(`/api/users/${clientA.id}`)
      .set("Authorization", `Bearer ${clientAToken}`);
    expect(getSelfByClient.status).toBe(200);

    // PENTESTER só vê a si mesmo na listagem
    const listAsPentester = await request(app).get("/api/users").set("Authorization", `Bearer ${pentesterToken}`);
    expect(listAsPentester.status).toBe(200);
    expect(listAsPentester.body).toHaveLength(1);
    expect(listAsPentester.body[0].id).toBe(pentester.id);

    // PENTESTER não pode ver outro usuário por id
    const getAdminByPentester = await request(app)
      .get(`/api/users/${admin.id}`)
      .set("Authorization", `Bearer ${pentesterToken}`);
    expect(getAdminByPentester.status).toBe(403);
    expect(getAdminByPentester.body.code).toBe("FORBIDDEN");
  });

  // USR-03
  it("PATCH/DELETE: usuário atualiza a si mesmo, não pode se autodeletar, e só ADMIN deleta outros", async () => {
    const admin = await seedUser({ name: "Admin", email: "admin@vulnera.local", password: PASSWORD, role: "ADMIN" });
    const clientA = await seedUser({ name: "Client A", email: "clientA@vulnera.local", password: PASSWORD, role: "CLIENT" });
    const clientB = await seedUser({ name: "Client B", email: "clientB@vulnera.local", password: PASSWORD, role: "CLIENT" });

    const adminToken = await loginAs(app, admin.email, PASSWORD);
    const clientAToken = await loginAs(app, clientA.email, PASSWORD);

    // usuário pode atualizar a si mesmo
    const updateSelf = await request(app)
      .patch(`/api/users/${clientA.id}`)
      .set("Authorization", `Bearer ${clientAToken}`)
      .send({ name: "Client A Renamed" });
    expect(updateSelf.status).toBe(200);
    expect(updateSelf.body.name).toBe("Client A Renamed");

    // não pode atualizar outro usuário
    const updateOther = await request(app)
      .patch(`/api/users/${clientB.id}`)
      .set("Authorization", `Bearer ${clientAToken}`)
      .send({ name: "Hack" });
    expect(updateOther.status).toBe(403);
    expect(updateOther.body.code).toBe("FORBIDDEN");

    // não pode se autodeletar
    const selfDelete = await request(app)
      .delete(`/api/users/${clientA.id}`)
      .set("Authorization", `Bearer ${clientAToken}`);
    expect(selfDelete.status).toBe(403);
    expect(selfDelete.body.code).toBe("SELF_DELETE_FORBIDDEN");

    // não-ADMIN não pode deletar outro usuário
    const deleteOtherAsClient = await request(app)
      .delete(`/api/users/${clientB.id}`)
      .set("Authorization", `Bearer ${clientAToken}`);
    expect(deleteOtherAsClient.status).toBe(403);
    expect(deleteOtherAsClient.body.code).toBe("FORBIDDEN");

    // ADMIN pode deletar outro usuário
    const deleteAsAdmin = await request(app)
      .delete(`/api/users/${clientB.id}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(deleteAsAdmin.status).toBe(204);

    // usuário deletado não existe mais
    const getDeleted = await request(app)
      .get(`/api/users/${clientB.id}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(getDeleted.status).toBe(404);
    expect(getDeleted.body.code).toBe("USER_NOT_FOUND");
  });
});
