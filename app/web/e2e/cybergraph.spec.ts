/**
 * cybergraph.spec.ts (e2e)
 *
 * O QUE FAZ
 * Dirige a aba CyberGraph do detalhe de um scan DAST de ponta a ponta: grupo de
 * findings, painel, modal, "Triar em Achados", busca, filtro por severidade,
 * arrastar e restaurar o layout, teclado, exportar PNG, troca de layout
 * (radial, estrela, orgânico, clusters), caminho mais crítico e movimento
 * reduzido. O modo 3D saiu (ADR-051).
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

const grafo2d = (page: Page) => page.locator('svg[aria-roledescription="grafo"]');
const painel = (page: Page) => page.getByRole("complementary", { name: "Detalhes do nó" });

async function abrirCyberGraph(page: Page, scanId: string): Promise<void> {
  // Os ativos (IP, portas, CVEs) chegam depois dos findings e mudam o layout: interagir antes disso clica no nó errado.
  const ativos = page.waitForResponse((r) => r.url().endsWith(`/dast/scans/${scanId}/assets`));
  await page.goto(`/dast/scans/${scanId}`);
  await ativos;
  await page.getByRole("tab", { name: "CyberGraph" }).click();
  await expect(grafo2d(page)).toBeVisible();
}


test.describe("CyberGraph", () => {
  let scanId: string;

  test.beforeAll(async ({ request }) => {
    scanId = await criarScanSimulado(request);
  });

  test.beforeEach(async ({ page }) => {
    // Cada abertura do scan faz ~5 GETs e o limite por usuário é 1/s com rajada de 10:
    // sem esse respiro, a suíte inteira tropeça em 429 (WEB-FUT-06), não em bug do grafo.
    await page.waitForTimeout(5_000);
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
    expect((await download).suggestedFilename()).toMatch(/^cybergraph-.+-hierarquico\.png$/);
  });

  test("CG-06 — cada layout redesenha o mesmo grafo, mantém a seleção e é lembrado", async ({ page }) => {
    await abrirCyberGraph(page, scanId);
    const nos = grafo2d(page).locator('g[role="button"]');
    const total = await nos.count();
    const alvo = grafo2d(page).locator('g[role="button"][aria-label^="Alvo"]');
    await alvo.click();
    const layouts = page.getByRole("group", { name: "Layout do grafo" });
    for (const nome of ["Radial", "Estrela", "Orgânico", "Clusters"]) {
      const antes = await alvo.getAttribute("transform");
      await layouts.getByRole("button", { name: nome }).click();
      await expect(layouts.getByRole("button", { name: nome })).toHaveAttribute("aria-pressed", "true");
      await expect(nos).toHaveCount(total);
      await expect(alvo).not.toHaveAttribute("transform", antes ?? "");
      await expect(alvo).toHaveAttribute("aria-pressed", "true");
    }
    // Clusters desenha as ilhas por severidade atrás dos nós.
    await expect(grafo2d(page).getByText(/^Estrutura · \d+$/)).toBeVisible();
    // A escolha fica salva (localStorage); volta ao padrão para não vazar para os outros casos.
    expect(await page.evaluate(() => localStorage.getItem("vulnera:cybergraph-layout"))).toBe("clusters");
    await page.getByRole("group", { name: "Layout do grafo" }).getByRole("button", { name: "Hierárquico" }).click();
  });

  test("CG-09 — Caminho mais crítico seleciona o finding de maior risco e acende o caminho até a Internet", async ({ page }) => {
    await abrirCyberGraph(page, scanId);
    await page.getByRole("button", { name: "Caminho mais crítico" }).click();
    const selecionado = grafo2d(page).locator('g[role="button"][aria-pressed="true"]');
    await expect(selecionado).toHaveCount(1);
    await expect(selecionado).toHaveAttribute("aria-label", /^Finding: .+, risco alto/);
    await expect(grafo2d(page).locator(".cg-fluxo").first()).toBeAttached();
    await expect(painel(page).getByText("Caminho de exposição")).toBeVisible();
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
