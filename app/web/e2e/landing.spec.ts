/**
 * landing.spec.ts (e2e)
 *
 * O QUE FAZ
 * Prova, num navegador de verdade, o que o jsdom não consegue provar sobre a
 * landing pública: quando a cena WebGL monta e quando o pôster ASCII assume
 * (ADR-055), e que a página não tem violação WCAG A/AA.
 *
 *   LP-01  tela larga, sem preferência: cena WebGL (ou pôster, se o navegador
 *          do teste não tiver WebGL) — nunca os dois, nunca erro de console
 *   LP-02  movimento reduzido do sistema: pôster, sem canvas
 *   LP-03  tela abaixo de 768 px: pôster, sem canvas
 *   LP-04  alto contraste do menu: fundo liso (sem canvas e pôster oculto)
 *   LP-05  a história inteira rola sem erro: do ato 0 ao ato 5
 *   LP-06  conteúdo: recursos reais na página e nada de "IA para Findings"
 *   LP-07  varredura axe-core sem violações A/AA
 *
 * POR QUE EXISTE
 * A cena é decoração, mas a regra de quando ela NÃO aparece é acessibilidade.
 * A landing é pública: este arquivo não precisa da API nem de login, e roda
 * tanto contra o container (`:8086`) quanto contra o Vite dev
 * (`E2E_BASE_URL=http://localhost:5179`).
 *
 * ⚠️ `bypassCSP`: a varredura injeta o axe como script inline (ver
 * acessibilidade.spec.ts).
 */

import { createRequire } from "node:module";
import { expect, test, type Page } from "@playwright/test";

const AXE = createRequire(import.meta.url).resolve("axe-core/axe.min.js");
const REGRAS_WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

test.use({ bypassCSP: true });

const cena = (page: Page) => page.locator("[data-landing-cena]");
const canvas = (page: Page) => page.locator("canvas[data-landing-scene]");
const poster = (page: Page) => page.locator("[data-landing-poster]");

/** Abre a landing já sem o boot de terminal (uma vez por sessão). */
async function abrir(page: Page, antes?: () => void) {
  await page.addInitScript(() => sessionStorage.setItem("vulnera:boot-visto", "1"));
  if (antes) await page.addInitScript(antes);
  await page.goto("/");
  await expect(page.locator('section[data-ato="5"]')).toBeAttached({ timeout: 30_000 });
}

function ouvirErros(page: Page): string[] {
  const erros: string[] = [];
  page.on("pageerror", (e) => erros.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" || /THREE\.|shader|WebGL: INVALID/i.test(m.text())) erros.push(m.text());
  });
  return erros;
}

test.describe("Landing — cena e pôster", () => {
  test("LP-01 — tela larga: cena WebGL quando há WebGL, senão pôster", async ({ page }) => {
    const erros = ouvirErros(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await abrir(page);
    await expect(cena(page)).toHaveAttribute("data-landing-cena", "webgl");
    // Sem GPU no navegador do teste a cena cai no pôster: os dois desfechos valem.
    await expect.poll(async () => (await canvas(page).getAttribute("data-ready").catch(() => null)) === "true"
      || (await poster(page).count()) === 1, { timeout: 20_000 }).toBe(true);
    await expect(canvas(page).or(poster(page)).first()).toHaveAttribute("aria-hidden", "true");
    expect(erros).toEqual([]);
  });

  test("LP-02 — movimento reduzido: pôster, sem canvas", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1440, height: 900 });
    await abrir(page);
    await expect(cena(page)).toHaveAttribute("data-landing-cena", "poster");
    await expect(poster(page)).toBeVisible();
    await expect(canvas(page)).toHaveCount(0);
  });

  test("LP-03 — abaixo de 768 px: pôster, sem canvas", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await abrir(page);
    await expect(cena(page)).toHaveAttribute("data-landing-cena", "poster");
    await expect(poster(page)).toBeVisible();
    await expect(canvas(page)).toHaveCount(0);
  });

  test("LP-04 — alto contraste: fundo liso", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await abrir(page, () => localStorage.setItem("vulnera:a11y", JSON.stringify({ altoContraste: true })));
    await expect(cena(page)).toHaveAttribute("data-landing-cena", "poster");
    await expect(canvas(page)).toHaveCount(0);
    await expect(poster(page)).toBeHidden();
  });

  test("LP-05 — a rolagem passa pelos seis atos sem erro", async ({ page }) => {
    const erros = ouvirErros(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await abrir(page);
    for (const ato of [1, 2, 3, 4, 5]) {
      await page.locator(`section[data-ato="${ato}"]`).scrollIntoViewIfNeeded();
      // A virada do ato 3 (a grade vira terreno) e a correção do ato 4
      // (os montes afundam) acontecem durante este intervalo.
      await page.waitForTimeout(700);
    }
    await expect(page.getByRole("heading", { name: "Planos que cabem na sua empresa." })).toBeVisible();
    expect(erros).toEqual([]);
  });
});

test.describe("Landing — conteúdo e acessibilidade", () => {
  test("LP-06 — recursos reais na página, sem IA", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await abrir(page);
    for (const titulo of ["Scanner DAST com OWASP ZAP", "Importação SAST e SCA", "Threat Intel", "Exposure Graph"]) {
      await expect(page.getByRole("heading", { name: titulo })).toBeAttached();
    }
    await expect(page.getByText("não ataca, não envia formulários e não faz login")).toBeAttached();
    await expect(page.getByText("IA para Findings")).toHaveCount(0);
  });

  test("LP-07 — sem violações WCAG A/AA", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await abrir(page);
    await page.waitForLoadState("networkidle");
    await page.addScriptTag({ path: AXE });
    const violacoes = await page.evaluate(async (tags) => {
      const axe = (window as unknown as { axe: typeof import("axe-core") }).axe;
      const r = await axe.run(document, { runOnly: { type: "tag", values: tags } });
      return r.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
    }, REGRAS_WCAG);
    expect(violacoes).toEqual([]);
  });
});
