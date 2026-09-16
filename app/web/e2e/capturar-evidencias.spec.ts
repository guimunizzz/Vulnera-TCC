/**
 * capturar-evidencias.spec.ts (e2e)
 *
 * Gera as capturas de tela da iniciativa **Exposure & Remediation Management**
 * em `docs/evidencias/exposure-remediation/screenshots/`.
 *
 * ⚠️ NÃO É UM TESTE — é um gerador de evidência, e está aqui por um motivo
 * prático: só o Playwright já sabe logar na stack real, esperar a tela
 * estabilizar e recortar o elemento certo. Ele falha se a tela não carregar,
 * o que é justamente o que se quer: uma evidência que não pôde ser produzida
 * não deve virar um arquivo antigo aproveitado.
 *
 * COMO RODAR (com a stack de pé e o catálogo semeado):
 *   npx playwright test e2e/capturar-evidencias.spec.ts
 *
 * As imagens mostram a base de DEMONSTRAÇÃO (`npm run db:seed`) — nenhum dado
 * real de cliente, nenhum token, nenhuma credencial na tela.
 */

import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { login, API_URL, CREDENCIAIS } from "./helpers";

// O projeto roda como ES module: não existe `__dirname`.
const AQUI = dirname(fileURLToPath(import.meta.url));
const DESTINO = join(AQUI, "..", "..", "..", "docs", "evidencias", "exposure-remediation", "screenshots");

test.beforeAll(() => {
  mkdirSync(DESTINO, { recursive: true });
});

test.use({ viewport: { width: 1440, height: 900 } });

test("captura as telas da iniciativa", async ({ page, request }) => {
  await login(page, "pentester");

  // 1. O catálogo de remediação, com as dez categorias do Top 10.
  await page.goto("/playbooks");
  await expect(page.getByRole("heading", { name: /playbooks de remediação/i })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: join(DESTINO, "01-playbooks-catalogo.png"), fullPage: false });

  // 2. Um playbook oficial aberto — conteúdo real e atribuição CC BY-SA.
  await page.goto("/playbooks?owaspCategory=A03");
  await page.getByRole("link", { name: /Injeção/i }).first().click();
  await expect(page.getByText(/OWASP Foundation/i)).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: join(DESTINO, "02-playbook-owasp-com-licenca.png"), fullPage: true });

  // 3. O finding com contexto, VRS, SLA e o bloco "Como corrigir".
  const auth = await request.post(`${API_URL}/auth/login`, {
    data: { email: CREDENCIAIS.pentester.email, password: CREDENCIAIS.pentester.senha },
  });
  const { accessToken } = await auth.json();
  const busca = await request.get(`${API_URL}/vulnerabilities?owaspCategory=A03&pageSize=1`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const { data } = await busca.json();
  if (data.length > 0) {
    await page.goto(`/findings/${data[0].id}`);
    await expect(page.getByRole("region", { name: /como corrigir/i })).toBeVisible();
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: join(DESTINO, "03-finding-como-corrigir.png"), fullPage: true });
  }

  // 4. O quadro de remediação.
  await page.goto("/remediation");
  await expect(page.getByRole("heading", { name: /quadro de remediação/i })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: join(DESTINO, "04-quadro-remediacao.png"), fullPage: false });

  // 5. O menu "Mover para…" aberto — as transições válidas, sem arrastar.
  const mover = page.getByRole("button", { name: /mover para/i }).first();
  if ((await mover.count()) > 0) {
    await mover.click();
    await expect(page.getByRole("menuitem").first()).toBeVisible();
    await page.screenshot({ path: join(DESTINO, "05-mover-para-menu.png"), fullPage: false });
    await page.keyboard.press("Escape");
  }

  // 6. A listagem com a faixa de buscas salvas.
  await page.goto("/findings?severity=CRITICAL&status=OPEN");
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: join(DESTINO, "06-buscas-salvas.png"), fullPage: false });
});
