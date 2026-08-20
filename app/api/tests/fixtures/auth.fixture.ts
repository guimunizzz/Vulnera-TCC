/**
 * auth.fixture.ts
 *
 * Helper pra logar via API e obter o accessToken — usado pelos testes de
 * user.test.ts pra montar o header Authorization.
 */

import request from "supertest";
import type { Express } from "express";

export async function loginAs(app: Express, email: string, password: string): Promise<string> {
  const res = await request(app).post("/api/auth/login").send({ email, password });
  return res.body.accessToken as string;
}
