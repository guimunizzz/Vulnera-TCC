import request from "supertest";
import jwt from "jsonwebtoken";
import { app } from "../../src/app";
import { prisma } from "../../src/database/prisma.database";
import { EnvVar } from "../../src/config/EnvVar";
import { EnvKeys } from "../../src/config/enum/EnvKeys";
import { RefreshTokenRepository } from "../../src/repositories/refresh-token.repository";
import type { UserRepository } from "../../src/repositories/user.repository";
import { AuthService } from "../../src/services/auth.service";
import { signRefreshToken, verifyAccessToken, verifyRefreshToken } from "../../src/utils/jwt.util";
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

  // AUTH-ROT-01
  it("duas rotações concorrentes do mesmo refresh token têm somente um vencedor", async () => {
    const user = await seedUser({ ...VALID_USER, role: "CLIENT" });
    const loginRes = await request(app).post("/api/auth/login").send({ email: VALID_USER.email, password: VALID_USER.password });
    const refreshToken = loginRes.body.refreshToken as string;

    const attempts = await Promise.all([
      request(app).post("/api/auth/refresh").send({ refreshToken }),
      request(app).post("/api/auth/refresh").send({ refreshToken }),
    ]);

    expect(attempts.map((response) => response.status).sort()).toEqual([200, 401]);
    const sessions = await prisma.refreshToken.findMany({ where: { userId: user.id } });
    expect(sessions.filter((session) => session.revokedAt === null)).toHaveLength(1);
  });

  // AUTH-EXP-01
  it("rejeita refresh quando expiresAt persistido venceu, mesmo com JWT ainda válido", async () => {
    await seedUser({ ...VALID_USER, role: "CLIENT" });
    const loginRes = await request(app).post("/api/auth/login").send({ email: VALID_USER.email, password: VALID_USER.password });
    const refreshToken = loginRes.body.refreshToken as string;
    const tokenHash = RefreshTokenRepository.hash(refreshToken);
    await prisma.refreshToken.update({
      where: { tokenHash },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });

    const response = await request(app).post("/api/auth/refresh").send({ refreshToken });
    expect(response.status).toBe(401);
    expect(response.body.code).toBe("INVALID_TOKEN");
  });

  // AUTH-STATE-01
  it("invalida acesso existente e impede login após desativação/avanço da versão", async () => {
    const user = await seedUser({ ...VALID_USER, role: "CLIENT" });
    const loginRes = await request(app).post("/api/auth/login").send({ email: VALID_USER.email, password: VALID_USER.password });
    const accessToken = loginRes.body.accessToken as string;

    await prisma.user.update({ where: { id: user.id }, data: { sessionVersion: { increment: 1 } } });
    const staleSession = await request(app).get("/api/users/me").set("Authorization", `Bearer ${accessToken}`);
    expect(staleSession.status).toBe(401);
    expect(staleSession.body.code).toBe("INVALID_TOKEN");

    await prisma.user.update({ where: { id: user.id }, data: { deactivatedAt: new Date(), sessionVersion: { increment: 1 } } });
    const loginAfterDeactivation = await request(app).post("/api/auth/login").send({ email: VALID_USER.email, password: VALID_USER.password });
    expect(loginAfterDeactivation.status).toBe(401);
    expect(loginAfterDeactivation.body.code).toBe("INVALID_CREDENTIALS");
  });

  // AUTH-ROLE-01
  it("usa o role persistido, não o role antigo assinado no access token", async () => {
    const admin = await seedUser({ ...VALID_USER, role: "ADMIN" });
    const loginRes = await request(app).post("/api/auth/login").send({ email: VALID_USER.email, password: VALID_USER.password });
    const accessToken = loginRes.body.accessToken as string;
    await prisma.user.update({ where: { id: admin.id }, data: { role: "CLIENT" } });

    const response = await request(app).get("/api/subscriptions/pending").set("Authorization", `Bearer ${accessToken}`);
    expect(response.status).toBe(403);
    expect(response.body.code ?? response.body.error).toBe("FORBIDDEN");
  });

  // AUTH-LEGACY-01
  it("aceita JWT legado sem sessionVersion enquanto a conta ainda estiver na versão zero", async () => {
    const user = await seedUser({ ...VALID_USER, role: "CLIENT" });
    const legacyToken = jwt.sign(
      { userId: user.id, role: "CLIENT" },
      EnvVar.get(EnvKeys.JWT_ACCESS_SECRET),
      { algorithm: "HS256", expiresIn: "15m" },
    );

    const response = await request(app).get("/api/users/me").set("Authorization", `Bearer ${legacyToken}`);
    expect(response.status).toBe(200);
    expect(response.body.id).toBe(user.id);
  });

  // AUTH-EXP-02
  it("revalida expiração depois que o refresh obtém os locks de User e token", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-11-25T12:00:00.000Z"));
    try {
      const refreshToken = signRefreshToken({ userId: "user-1", role: "CLIENT", sessionVersion: 0 });
      const claims = verifyRefreshToken(refreshToken);
      const expiresAt = new Date(claims.exp! * 1000);
      const stored = {
        id: "refresh-1", userId: "user-1", tokenHash: RefreshTokenRepository.hash(refreshToken),
        expiresAt, revokedAt: null, createdAt: new Date("2026-11-25T12:00:00.000Z"),
      };
      const refreshTokens = {
        findByHash: async () => stored,
        transaction: async (operation: (repositories: unknown) => Promise<unknown>) => operation({
          users: {
            lockById: async () => {
              jest.setSystemTime(new Date(expiresAt.getTime() + 1));
              return { id: "user-1", role: "CLIENT", sessionVersion: 0, deactivatedAt: null };
            },
          },
          refreshTokens: {
            findByHashForUpdate: async () => stored,
            revoke: jest.fn(),
            create: jest.fn(),
          },
        }),
      } as unknown as RefreshTokenRepository;
      const service = new AuthService({} as UserRepository, refreshTokens);

      await expect(service.refresh(refreshToken)).rejects.toThrow("INVALID_TOKEN");
    } finally {
      jest.useRealTimers();
    }
  });

  // AUTH-JWT-EXP-01
  it("rejeita access JWT assinado sem expiração", () => {
    const token = jwt.sign(
      { userId: "user-1", role: "CLIENT" },
      EnvVar.get(EnvKeys.JWT_ACCESS_SECRET),
      { algorithm: "HS256" },
    );

    expect(() => verifyAccessToken(token)).toThrow("INVALID_TOKEN");
  });
});
