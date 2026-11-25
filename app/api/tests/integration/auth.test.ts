import request from "supertest";
import { app } from "../../src/app";
import { prisma } from "../../src/database/prisma.database";
import { cleanDatabase } from "../setup";
import { seedUser } from "../fixtures/users.fixture";

const VALID_USER = {
  name: "Auth Tester",
  email: "auth.tester@vulnera.local",
  password: "senha12345",
};

describe("Auth (login/refresh/logout)", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it("POST /api/auth/register não existe e não cria usuário nem sessão", async () => {
    const res = await request(app).post("/api/auth/register").send(VALID_USER);

    expect(res.status).toBe(404);
    expect(res.body.accessToken).toBeUndefined();
    expect(res.body.refreshToken).toBeUndefined();
    expect(await prisma.user.count()).toBe(0);
    expect(await prisma.refreshToken.count()).toBe(0);
  });

  // AUTH-06
  it("POST /api/auth/login com credenciais válidas retorna tokens", async () => {
    await seedUser({ ...VALID_USER, role: "CLIENT" });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: VALID_USER.email, password: VALID_USER.password });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.user.email).toBe(VALID_USER.email);
  });

  // AUTH-07
  it("POST /api/auth/login com senha errada retorna 401 INVALID_CREDENTIALS", async () => {
    await seedUser({ ...VALID_USER, role: "CLIENT" });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: VALID_USER.email, password: "senhaErrada" });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("INVALID_CREDENTIALS");
  });

  // AUTH-08
  it("POST /api/auth/refresh roda rotation: novo par funciona, o token antigo é invalidado", async () => {
    await seedUser({ ...VALID_USER, role: "CLIENT" });
    const loginRes = await request(app).post("/api/auth/login").send({ email: VALID_USER.email, password: VALID_USER.password });
    const oldRefreshToken = loginRes.body.refreshToken as string;

    const refreshRes = await request(app).post("/api/auth/refresh").send({ refreshToken: oldRefreshToken });

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.accessToken).toBeDefined();
    expect(refreshRes.body.refreshToken).toBeDefined();
    expect(refreshRes.body.refreshToken).not.toBe(oldRefreshToken);

    // o refresh token antigo já foi revogado pela rotation
    const reuseRes = await request(app).post("/api/auth/refresh").send({ refreshToken: oldRefreshToken });
    expect(reuseRes.status).toBe(401);
    expect(reuseRes.body.code).toBe("INVALID_TOKEN");
  });

  // AUTH-09
  it("POST /api/auth/logout revoga o refresh token e bloqueia rotas autenticadas sem token", async () => {
    await seedUser({ ...VALID_USER, role: "CLIENT" });
    const loginRes = await request(app).post("/api/auth/login").send({ email: VALID_USER.email, password: VALID_USER.password });
    const { refreshToken } = loginRes.body as { refreshToken: string };

    const logoutRes = await request(app).post("/api/auth/logout").send({ refreshToken });
    expect(logoutRes.status).toBe(204);

    const refreshAfterLogout = await request(app).post("/api/auth/refresh").send({ refreshToken });
    expect(refreshAfterLogout.status).toBe(401);
    expect(refreshAfterLogout.body.code).toBe("INVALID_TOKEN");

    const meWithoutToken = await request(app).get("/api/users/me");
    expect(meWithoutToken.status).toBe(401);
    expect(meWithoutToken.body.code).toBe("UNAUTHORIZED");
  });
});
