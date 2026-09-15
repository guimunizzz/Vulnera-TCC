/**
 * helpers.ts (e2e)
 *
 * Utilidades compartilhadas pelos testes de ponta a ponta: login pela UI,
 * criação de scan e espera pelo término.
 *
 * ⚠️ O login é feito PELA INTERFACE, não injetando token no localStorage.
 * Injetar seria mais rápido, mas deixaria de exercitar justamente a parte que
 * mais quebra na prática (formulário, redirecionamento, guarda de rota) — e é
 * a primeira coisa que a banca vai ver funcionando.
 */

import { expect, type Page, type APIRequestContext } from "@playwright/test";

export const CREDENCIAIS = {
  pentester: { email: "bruno.pentester@vulnera.local", senha: "senha12345" },
  admin: { email: "admin@vulnera.local", senha: "admin12345" },
};

export const API_URL = process.env.E2E_API_URL ?? "http://localhost:3001/api";

/** Alvo público e reservado pela IANA para documentação/testes — o mesmo das evidências do projeto. */
export function alvoUnico(sufixo: string): string {
  return `https://example.com/?e2e=${sufixo}-${Date.now()}`;
}

export async function login(page: Page, quem: keyof typeof CREDENCIAIS = "pentester"): Promise<void> {
  const { email, senha } = CREDENCIAIS[quem];
  await page.goto("/login");
  await page.getByLabel(/e-mail/i).fill(email);
  await page.getByLabel(/senha/i).fill(senha);
  await page.getByRole("button", { name: /entrar/i }).click();
  // A guarda de rota redireciona pro dashboard — é o sinal de que o token valeu.
  await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 30_000 });
}

/**
 * Cria um scan pela API (não pela UI) e devolve o id.
 * Usado quando o teste é sobre o que se faz DEPOIS do scan — montar o estado
 * pela API é mais rápido e menos frágil do que dirigir a UI só pra chegar lá.
 */
export async function criarScanViaApi(request: APIRequestContext, targetUrl: string): Promise<string> {
  const login = await request.post(`${API_URL}/auth/login`, {
    data: { email: CREDENCIAIS.pentester.email, password: CREDENCIAIS.pentester.senha },
  });
  expect(login.ok(), "login pela API falhou — a stack está de pé?").toBeTruthy();
  const { accessToken } = await login.json();

  const criado = await request.post(`${API_URL}/dast/scans`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    data: { targetUrl },
  });
  expect(criado.status(), await criado.text()).toBe(201);
  return (await criado.json()).id as string;
}

/** Espera o scan chegar a um estado terminal, consultando a API direto. */
export async function esperarScanTerminar(
  request: APIRequestContext,
  scanId: string,
  maxMs = 4 * 60 * 1000,
): Promise<any> {
  const login = await request.post(`${API_URL}/auth/login`, {
    data: { email: CREDENCIAIS.pentester.email, password: CREDENCIAIS.pentester.senha },
  });
  const { accessToken } = await login.json();

  const prazo = Date.now() + maxMs;
  while (Date.now() < prazo) {
    const res = await request.get(`${API_URL}/dast/scans/${scanId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const scan = await res.json();
    if (["COMPLETED", "FAILED", "CANCELLED"].includes(scan.status)) return scan;
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error(`scan ${scanId} não terminou em ${maxMs}ms`);
}
