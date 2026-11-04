/**
 * cybergraph.spec.ts (e2e)
 *
 * O QUE FAZ
 * Dirige a aba CyberGraph do detalhe de um scan DAST de ponta a ponta: grupo de
 * findings, painel, modal, "Triar em Achados", busca, filtro por severidade,
 * arrastar e restaurar o layout, teclado, exportar PNG, modo 3D (com grupos que
 * abrem e fecham) e movimento reduzido.
 *
 * POR QUE EXISTE
 * Os testes de unidade cobrem layout e montagem do detalhe; a fiação entre SVG,
 * painel, modal e a lista de achados só aparece com o navegador de verdade.
 *
 * ⚠️ Usa um scan SIMULADO criado pela API: termina em segundos, sempre com os
 * mesmos 15 findings, e não depende do ZAP nem de um alvo controlado.
 */

import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { API_URL, CREDENCIAIS, login } from "./helpers";

async function criarScanSimulado(request: APIRequestContext): Promise<string> {
  const auth = await request.post(`${API_URL}/auth/login`, {
    data: { email: CREDENCIAIS.pentester.email, password: CREDENCIAIS.pentester.senha },
  });
  expect(auth.ok(), "login pela API falhou — a stack está de pé?").toBeTruthy();
  const { accessToken } = await auth.json();
  const headers = { Authorization: `Bearer ${accessToken}` };
  const criado = await request.post(`${API_URL}/dast/scans`, {
    headers,
    data: { targetUrl: "https://cybergraph-e2e.exemplo.com/", mode: "SIMULATED" },
  });
  expect(criado.status(), await criado.text()).toBe(201);
  const { id } = await criado.json();
  await expect
    .poll(async () => (await (await request.get(`${API_URL}/dast/scans/${id}`, { headers })).json()).status, { timeout: 120_000 })
    .toBe("COMPLETED");
  return id as string;
}

async function abrirCyberGraph(page: Page, scanId: string, modo: "2D" | "3D" = "2D"): Promise<void> {
  // Os ativos (IP, portas, CVEs) chegam depois dos findings e mudam o layout: interagir antes disso clica no nó errado.
  const ativos = page.waitForResponse((r) => r.url().endsWith(`/dast/scans/${scanId}/assets`));
  await page.goto(`/dast/scans/${scanId}`);
  await ativos;
  await page.getByRole("tab", { name: "CyberGraph" }).click();
  await page.getByRole("button", { name: modo, exact: true }).click();
}

const grafo2d = (page: Page) => page.locator('svg[aria-roledescription="grafo"]');
const painel = (page: Page) => page.getByRole("complementary", { name: "Detalhes do nó" });

test.describe("CyberGraph", () => {
  let scanId: string;

  test.beforeAll(async ({ request }) => {
    scanId = await criarScanSimulado(request);
  });

  test.beforeEach(async ({ page }) => {
    await login(page, "pentester");
  });

  test("CG-01 — grupo expande, painel mostra o caminho, modal abre e leva à triagem", async ({ page }) => {
    await abrirCyberGraph(page, scanId);
    const grupo = grafo2d(page).locator('g[role="button"][aria-label^="Grupo de findings"]').first();
    await grupo.click();
    await expect(grupo).toHaveAttribute("aria-expanded", "true");

    const finding = grafo2d(page).locator('g[role="button"][aria-label^="Finding:"]').first();
    const titulo = (await finding.locator("title").textContent()) ?? "";
    await finding.click();
    await expect(painel(page).getByRole("heading", { name: titulo })).toBeVisible();
    await expect(painel(page).getByText("Caminho de exposição")).toBeVisible();

    await finding.dblclick();
    const modal = page.getByRole("dialog");
    await expect(modal.getByRole("heading", { name: titulo })).toBeVisible();
    await modal.getByRole("button", { name: "Triar em Achados" }).click();
    await expect(modal).toBeHidden();
    await expect(page.getByRole("tab", { name: /Achados/ })).toHaveAttribute("aria-selected", "true");
    await expect(page.locator('[id^="finding-detalhe-"]')).toBeVisible();
  });

  test("CG-02 — busca seleciona o nó e o filtro de severidade tira findings do grafo", async ({ page }) => {
    await abrirCyberGraph(page, scanId);
    await page.getByLabel("Buscar nó no grafo").fill("SQL Injection");
    await page.getByLabel("Buscar nó no grafo").press("Enter");
    await expect(painel(page).getByRole("heading", { name: "SQL Injection" })).toBeVisible();

    const nos = grafo2d(page).locator('g[role="button"]');
    const antes = await nos.count();
    const filtro = page.getByRole("group", { name: "Filtrar findings por severidade" });
    await filtro.getByRole("button", { name: /Baixo/ }).click();
    await filtro.getByRole("button", { name: /Informativo/ }).click();
    await expect(page.getByText(/Mostrando \d+ de \d+ findings/)).toBeVisible();
    expect(await nos.count()).toBeLessThan(antes);

    await page.getByLabel("Buscar nó no grafo").fill("nada-com-esse-nome");
    await page.getByLabel("Buscar nó no grafo").press("Enter");
    await expect(page.getByText(/Nenhum nó com “nada-com-esse-nome”/)).toBeVisible();
  });

  test("CG-03 — arrastar um nó habilita Restaurar layout, que volta ao padrão", async ({ page }) => {
    await abrirCyberGraph(page, scanId);
    const restaurar = page.getByRole("button", { name: "Restaurar layout" });
    await expect(restaurar).toBeDisabled();

    const alvo = grafo2d(page).locator('g[role="button"][aria-label^="Alvo"]');
    const original = await alvo.getAttribute("transform");
    // A faixa de sensores empurra o grafo para baixo: o nó precisa estar na tela para o mouse alcançá-lo.
    await alvo.scrollIntoViewIfNeeded();
    const caixa = await alvo.boundingBox();
    if (!caixa) throw new Error("nó do alvo sem caixa");
    await page.mouse.move(caixa.x + caixa.width / 2, caixa.y + caixa.height / 3);
    await page.mouse.down();
    await page.mouse.move(caixa.x + caixa.width / 2 + 40, caixa.y - 60, { steps: 8 });
    await page.mouse.up();

    await expect(alvo).not.toHaveAttribute("transform", original ?? "");
    await expect(restaurar).toBeEnabled();
    await restaurar.click();
    await expect(alvo).toHaveAttribute("transform", original ?? "");
    await expect(restaurar).toBeDisabled();
  });

  test("CG-04 — um ponto de Tab no grafo e setas andam entre os nós", async ({ page }) => {
    await abrirCyberGraph(page, scanId);
    const tabulaveis = grafo2d(page).locator('g[role="button"][tabindex="0"]');
    await expect(tabulaveis).toHaveCount(1);
    await tabulaveis.focus();
    const antes = await page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
    await page.keyboard.press("ArrowRight");
    const depois = await page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
    expect(depois).toBeTruthy();
    expect(depois).not.toBe(antes);
    await expect(tabulaveis).toHaveCount(1);
  });

  test("CG-08 — sensor de headers aparece na faixa de sensores e o finding dele mostra a origem", async ({ page }) => {
    await abrirCyberGraph(page, scanId);
    // A faixa fica na página do scan, acima das abas, e vale para Achados e CyberGraph.
    const faixa = page.getByRole("region", { name: "Sensores deste scan" });
    await expect(faixa).toContainText("OWASP ZAP");
    await expect(faixa).toContainText(/Headers de segurança\s*OK · \d+ achados?/);
    await expect(faixa).toContainText(/Certificado SSL\/TLS\s*OK · \d+ achados?/);

    await page.getByLabel("Buscar nó no grafo").fill("CSP ausente");
    await page.getByLabel("Buscar nó no grafo").press("Enter");
    await expect(painel(page).getByRole("heading", { name: "CSP ausente" })).toBeVisible();
    await expect(painel(page)).toContainText("Headers de segurança");
  });

  test("CG-05 — exportar PNG baixa a imagem do grafo 2D", async ({ page }) => {
    await abrirCyberGraph(page, scanId);
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Exportar PNG" }).click();
    expect((await download).suggestedFilename()).toMatch(/^cybergraph-.+-2d\.png$/);
  });

  test("CG-06 — modo 3D monta a cena com nomes e exporta PNG", async ({ page }) => {
    await abrirCyberGraph(page, scanId);
    const botao3d = page.getByRole("button", { name: "3D", exact: true });
    test.skip(await botao3d.isDisabled(), "navegador do teste sem WebGL 2");
    await botao3d.click();
    const canvas = page.locator('canvas[aria-roledescription="grafo 3D"]');
    test.skip(!(await canvas.isVisible({ timeout: 20_000 }).catch(() => false)), "WebGL não iniciou neste ambiente");
    await expect(canvas).toHaveCount(1);
    // Nomes fixos: um por nó, na camada de rótulos sobre o canvas.
    await expect(page.locator('canvas[aria-roledescription="grafo 3D"] ~ div[aria-hidden="true"] > div').first()).toBeAttached();
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Exportar PNG" }).click();
    expect((await download).suggestedFilename()).toMatch(/^cybergraph-.+-3d\.png$/);
  });

  test("CG-09 — no 3D os grupos começam fechados e Espaço abre e fecha o do endpoint", async ({ page }) => {
    await abrirCyberGraph(page, scanId);
    // Nome de um endpoint pelo 2D, onde cada nó é um botão com título.
    const endpoint = (await grafo2d(page).locator('g[role="button"][aria-label^="Endpoint"] title').first().textContent()) ?? "";
    expect(endpoint).not.toBe("");

    const botao3d = page.getByRole("button", { name: "3D", exact: true });
    test.skip(await botao3d.isDisabled(), "navegador do teste sem WebGL 2");
    await botao3d.click();
    const canvas = page.locator('canvas[aria-roledescription="grafo 3D"]');
    test.skip(!(await canvas.isVisible({ timeout: 20_000 }).catch(() => false)), "WebGL não iniciou neste ambiente");
    const visiveis = async () => Number((await canvas.getAttribute("aria-label"))?.match(/(\d+) de \d+ nós visíveis/)?.[1]);
    await expect(canvas).toHaveAttribute("aria-label", /\d+ de \d+ nós visíveis/);
    const fechado = await visiveis();
    // Grupo fechado: selo "▸ N" antes do nome, na camada de rótulos.
    const rotulos = page.locator('canvas[aria-roledescription="grafo 3D"] ~ div[aria-hidden="true"]');
    await expect(rotulos.getByText(/^▸ \d+$/).first()).toBeAttached();

    await page.getByLabel("Buscar nó no grafo").fill(endpoint);
    await page.getByLabel("Buscar nó no grafo").press("Enter");
    await expect(painel(page).getByRole("heading", { name: endpoint })).toBeVisible();
    await canvas.focus();
    await page.keyboard.press(" ");
    await expect.poll(visiveis).toBeGreaterThan(fechado);
    await expect(rotulos.getByText(/^▾ \d+$/).first()).toBeAttached();
    await page.keyboard.press(" ");
    await expect.poll(visiveis).toBe(fechado);
  });

  test.describe("com movimento reduzido", () => {
    test.use({ reducedMotion: "reduce" });

    test("CG-07 — o fluxo animado do caminho e a entrada escalonada param", async ({ page }) => {
      await abrirCyberGraph(page, scanId);
      await grafo2d(page).locator('g[role="button"][aria-label^="Alvo"]').click();
      const fluxo = grafo2d(page).locator(".cg-fluxo").first();
      await expect(fluxo).toBeAttached();
      expect(await fluxo.evaluate((el) => getComputedStyle(el).animationName)).toBe("none");

      await grafo2d(page).locator('g[role="button"][aria-label^="Alvo"]').dblclick();
      const modal = page.getByRole("dialog");
      await expect(modal).toBeVisible();
      // Sem escala na entrada do overlay: o painel já nasce sem transform.
      expect(await modal.evaluate((el) => getComputedStyle(el).transform)).toBe("none");
    });
  });
});
