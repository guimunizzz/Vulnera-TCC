import request from "supertest";
import { app } from "../../src/app";
import { cleanDatabase } from "../setup";
import { prisma } from "../../src/database/prisma.database";
import { seedUser } from "../fixtures/users.fixture";
import { loginAs } from "../fixtures/auth.fixture";

const PASSWORD = "senha12345";
const VALID_TOKEN = "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]";

describe("Notification (register-push)", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  // PUSH-01 — registra o token no usuário autenticado
  it("POST /api/notifications/register-push: salva o expoPushToken no usuário logado", async () => {
    const client = await seedUser({ name: "Cliente", email: "client@vulnera.local", password: PASSWORD, role: "CLIENT" });
    const token = await loginAs(app, client.email, PASSWORD);

    const res = await request(app)
      .post("/api/notifications/register-push")
      .set("Authorization", `Bearer ${token}`)
      .send({ expoPushToken: VALID_TOKEN });

    expect(res.status).toBe(204);

    const updated = await prisma.user.findUnique({ where: { id: client.id } });
    expect(updated?.expoPushToken).toBe(VALID_TOKEN);
  });

  it("POST /api/notifications/register-push: token com formato inválido retorna 400", async () => {
    const client = await seedUser({ name: "Cliente", email: "client2@vulnera.local", password: PASSWORD, role: "CLIENT" });
    const token = await loginAs(app, client.email, PASSWORD);

    const res = await request(app)
      .post("/api/notifications/register-push")
      .set("Authorization", `Bearer ${token}`)
      .send({ expoPushToken: "nao-e-um-token-expo" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("INVALID_EXPO_PUSH_TOKEN");
  });

  it("POST /api/notifications/register-push sem autenticação retorna 401", async () => {
    const res = await request(app).post("/api/notifications/register-push").send({ expoPushToken: VALID_TOKEN });
    expect(res.status).toBe(401);
  });

  it("registrar de novo (2º login, 2º token) sobrescreve o token anterior", async () => {
    const client = await seedUser({ name: "Cliente", email: "client3@vulnera.local", password: PASSWORD, role: "CLIENT" });
    const token = await loginAs(app, client.email, PASSWORD);

    await request(app)
      .post("/api/notifications/register-push")
      .set("Authorization", `Bearer ${token}`)
      .send({ expoPushToken: VALID_TOKEN });

    const secondToken = "ExponentPushToken[yyyyyyyyyyyyyyyyyyyyyy]";
    await request(app)
      .post("/api/notifications/register-push")
      .set("Authorization", `Bearer ${token}`)
      .send({ expoPushToken: secondToken });

    const updated = await prisma.user.findUnique({ where: { id: client.id } });
    expect(updated?.expoPushToken).toBe(secondToken);
  });
});
