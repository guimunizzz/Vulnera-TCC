import request from "supertest";
import { app } from "../../src/app";
import { cleanDatabase } from "../setup";

const VALID_USER = {
  name: "Auth Tester",
  email: "auth.tester@vulnera.local",
  password: "senha12345",
};

describe("Auth (register/login/refresh/logout)", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  // AUTH-01
  it("POST /api/auth/register cria usuário CLIENT e retorna tokens sem expor a senha", async () => {
    const res = await request(app).post("/api/auth/register").send(VALID_USER);

    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.user).toMatchObject({
      name: VALID_USER.name,
      email: VALID_USER.email,
      role: "CLIENT",
      companyId: null,
    });
    expect(res.body.user.password).toBeUndefined();
  });

  // AUTH-02
  it("POST /api/auth/register com email já cadastrado retorna 409 EMAIL_ALREADY_EXISTS", async () => {
    await request(app).post("/api/auth/register").send(VALID_USER);

    const res = await request(app).post("/api/auth/register").send(VALID_USER);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("EMAIL_ALREADY_EXISTS");
  });

  // AUTH-03
  it("POST /api/auth/register com nome curto retorna 400 INVALID_NAME", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ ...VALID_USER, name: "Al" });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_NAME");
  });

  // AUTH-04
  it("POST /api/auth/register com email inválido retorna 400 INVALID_EMAIL", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ ...VALID_USER, email: "nao-e-email" });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_EMAIL");
  });

  // AUTH-05
  it("POST /api/auth/register com senha curta retorna 400 WEAK_PASSWORD", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ ...VALID_USER, password: "1234567" });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("WEAK_PASSWORD");
  });

  // AUTH-06
  it("POST /api/auth/login com credenciais válidas retorna tokens", async () => {
    await request(app).post("/api/auth/register").send(VALID_USER);

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
    await request(app).post("/api/auth/register").send(VALID_USER);

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: VALID_USER.email, password: "senhaErrada" });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("INVALID_CREDENTIALS");
  });

  // AUTH-08
  it("POST /api/auth/refresh roda rotation: novo par funciona, o token antigo é invalidado", async () => {
    const registerRes = await request(app).post("/api/auth/register").send(VALID_USER);
    const oldRefreshToken = registerRes.body.refreshToken as string;

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
    const registerRes = await request(app).post("/api/auth/register").send(VALID_USER);
    const { refreshToken } = registerRes.body as { refreshToken: string };

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
