/**
 * exposure-graph.spec.ts (e2e)
 *
 * O QUE FAZ
 * Dirige a página do Exposure Graph com o CLIENT da TechNova (seed de demo):
 * grafo da empresa com categorias compartilhadas, painel da aplicação com
 * link para a vulnerabilidade, troca de layout, filtro "só expostas" e o mapa
 * 3D com a lista acessível de prédios.
 *
 * POR QUE EXISTE
 * O teste de integração da API prova o contrato e o isolamento; aqui se prova
 * a fiação entre a API, o grafo, o painel e o mapa no navegador de verdade.
 * Depende do seed de demo (`npm run db:seed:demo`).
 */

import { expect, test } from "@playwright/test";
import { login } from "./helpers";

const grafo = (page: import("@playwright/test").Page) => page.locator('svg[aria-roledescription="grafo"]');

test.describe("Exposure Graph", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, "cliente");
    await page.getByRole("link", { name: "Exposure Graph" }).click();
    await expect(page.getByRole("heading", { name: "Exposure Graph", level: 1 })).toBeVisible();
    await expect(grafo(page)).toBeVisible();
  });

  test("EG-01 — empresa, aplicações e categorias; selecionar a aplicação mostra o contexto e leva à vulnerabilidade", async ({ page }) => {
    await expect(grafo(page).locator('g[role="button"][aria-label^="Empresa:"]')).toHaveCount(1);
    const apps = grafo(page).locator('g[role="button"][aria-label^="Aplicação:"]');
    expect(await apps.count()).toBeGreaterThan(0);
    await expect(grafo(page).locator('g[role="button"][aria-label^="Categoria OWASP:"]').first()).toBeAttached();

    const comAbertas = grafo(page).locator('g[role="button"][aria-label^="Aplicação:"][aria-label*="risco"]').first();
    const nome = (await comAbertas.locator("title").textContent()) ?? "";
    await comAbertas.click();
    const painel = page.getByRole("complementary", { name: "Detalhes da seleção" });
    await expect(painel.getByRole("heading", { name: nome })).toBeVisible();
    await expect(painel.getByText("Mais graves em aberto")).toBeVisible();
    await painel.getByRole("link").first().click();
    await expect(page).toHaveURL(/\/findings\/[^/]+$/);
  });

  test("EG-02 — layouts e filtro de exposição redesenham sem perder nós indevidamente", async ({ page }) => {
    const nos = grafo(page).locator('g[role="button"]');
    const total = await nos.count();
    for (const nome of ["Hierárquico", "Radial", "Estrela", "Clusters"]) {
      await page.getByRole("group", { name: "Layout do grafo" }).getByRole("button", { name: nome }).click();
      await expect(nos).toHaveCount(total);
    }
    await page.getByRole("switch", { name: "Só expostas à Internet" }).click();
    await expect.poll(() => nos.count()).toBeLessThanOrEqual(total);
  });

  test("EG-03 — mapa 3D abre com a lista de prédios, que seleciona a aplicação no painel", async ({ page }) => {
    await page.getByRole("tab", { name: "Mapa 3D" }).click();
    const lista = page.getByRole("list", { name: "Aplicações no mapa" });
    await expect(lista).toBeVisible({ timeout: 30_000 });
    const primeiro = lista.getByRole("button").first();
    const nome = ((await primeiro.textContent()) ?? "").replace(/, exposta à Internet$/, "").replace(/\d+$/, "").trim();
    await primeiro.click();
    await expect(primeiro).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("complementary", { name: "Detalhes da seleção" }).getByRole("heading", { name: nome })).toBeVisible();
  });
});
