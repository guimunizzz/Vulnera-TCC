/**
 * acessibilidade.spec.ts (e2e)
 *
 * O QUE FAZ
 * Dirige o menu de acessibilidade na stack real e varre as telas principais
 * com o axe-core (regras WCAG 2.x níveis A e AA — inclusive texto alternativo
 * de imagem, `image-alt`, `svg-img-alt` e `role-img-alt`).
 *
 * POR QUE EXISTE
 * Os testes de unidade provam o painel no jsdom, que não aplica CSS. Aqui se
 * prova o efeito de verdade: a letra muda de tamanho, a escolha sobrevive ao
 * recarregar, o alto contraste troca a cor computada, as animações encurtam,
 * o espaçamento segue o WCAG 1.4.12 e nenhuma tela tem violação AA.
 *
 * ⚠️ `bypassCSP`: a varredura injeta o axe como script inline, e a CSP do
 * `vite preview` (config/csp.ts) bloqueia inline por padrão — de propósito.
 */

import { createRequire } from "node:module";
import { expect, test, type Page } from "@playwright/test";
import { login } from "./helpers";

const AXE = createRequire(import.meta.url).resolve("axe-core/axe.min.js");
const REGRAS_WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

test.use({ bypassCSP: true });

const tamanhoDaRaiz = (page: Page) => page.evaluate(() => getComputedStyle(document.documentElement).fontSize);
const token = (page: Page, nome: string) =>
  page.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), nome);

async function abrirMenu(page: Page) {
  await page.getByRole("button", { name: /^Acessibilidade/ }).click();
  const painel = page.getByRole("dialog", { name: "Acessibilidade" });
  await expect(painel).toBeVisible();
  return painel;
}

async function varrer(page: Page): Promise<string[]> {
  await page.addScriptTag({ path: AXE });
  return page.evaluate(async (tags) => {
    const axe = (window as unknown as { axe: typeof import("axe-core") }).axe;
    const r = await axe.run(document, { runOnly: { type: "tag", values: tags } });
    return r.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
  }, REGRAS_WCAG);
}

test.describe("Menu de acessibilidade", () => {
  test("AC-01 — no login fica no canto superior direito e o texto ampliado sobrevive ao recarregar", async ({ page }) => {
    await page.goto("/login");
    const caixa = await page.getByRole("button", { name: "Acessibilidade" }).boundingBox();
    const largura = page.viewportSize()?.width ?? 0;
    expect(caixa?.x).toBeGreaterThan(largura * 0.85);
    expect(caixa?.y).toBeLessThan(80);

    const painel = await abrirMenu(page);
    for (let i = 0; i < 3; i++) await painel.getByRole("button", { name: "Aumentar texto" }).click();
    await expect(painel.locator("output")).toHaveText("150%");
    expect(await tamanhoDaRaiz(page)).toBe("24px");

    await page.reload();
    expect(await tamanhoDaRaiz(page)).toBe("24px");

    // 200% é o teto do WCAG 1.4.4 — e a página não pode ganhar rolagem lateral.
    const painel2 = await abrirMenu(page);
    for (let i = 0; i < 2; i++) await painel2.getByRole("button", { name: "Aumentar texto" }).click();
    await expect(painel2.locator("output")).toHaveText("200%");
    await expect(painel2.getByRole("button", { name: "Aumentar texto" })).toHaveAttribute("aria-disabled", "true");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test("AC-02 — no app, cada opção muda o CSS computado de verdade", async ({ page }) => {
    await login(page, "pentester");
    const raiz = page.locator("html");
    const painel = await abrirMenu(page);

    const atenuadoAntes = await token(page, "--color-text-muted");
    await painel.getByRole("switch", { name: "Alto contraste" }).click();
    await expect(raiz).toHaveAttribute("data-alto-contraste", "");
    expect(await token(page, "--color-text-muted")).not.toBe(atenuadoAntes);

    await painel.getByRole("switch", { name: "Reduzir animações" }).click();
    expect(await token(page, "--duration-base")).toBe("1ms");

    await painel.getByRole("switch", { name: "Espaçamento de texto" }).click();
    await expect(raiz).toHaveAttribute("data-espacamento-texto", "");
    const proporcao = () =>
      page.evaluate(() => {
        const estilo = getComputedStyle(document.querySelector("main h1") as Element);
        return parseFloat(estilo.letterSpacing) / parseFloat(estilo.fontSize);
      });
    await expect.poll(proporcao).toBeCloseTo(0.12, 2);

    await painel.getByRole("switch", { name: "Sublinhar links" }).click();
    const sublinhado = await page.evaluate(
      () => getComputedStyle(document.querySelector("nav a[href]") as Element).textDecorationLine,
    );
    expect(sublinhado).toBe("underline");

    await painel.getByRole("switch", { name: "Foco reforçado" }).click();
    // Escape fecha e devolve o foco ao gatilho, que agora mostra o anel grosso.
    await page.keyboard.press("Escape");
    const gatilho = page.getByRole("button", { name: "Acessibilidade (ajustes ativos)" });
    await expect(gatilho).toBeFocused();
    expect(await gatilho.evaluate((el) => getComputedStyle(el).outlineWidth)).toBe("4px");
  });
});

test.describe("Varredura WCAG A/AA (axe-core)", () => {
  test("AC-03 — páginas públicas sem violações", async ({ page }) => {
    const achados: string[] = [];
    for (const rota of ["/login", "/register", "/plans"]) {
      await page.goto(rota);
      await page.waitForLoadState("networkidle");
      achados.push(...(await varrer(page)).map((v) => `${rota} → ${v}`));
    }
    expect(achados).toEqual([]);
  });

  test("AC-04 — telas autenticadas sem violações, também com alto contraste e texto a 200%", async ({ page }) => {
    await login(page, "pentester");
    const achados: string[] = [];
    for (const rota of ["/dashboard", "/projects", "/findings", "/remediation", "/playbooks", "/dast"]) {
      await page.goto(rota);
      await page.waitForLoadState("networkidle");
      achados.push(...(await varrer(page)).map((v) => `${rota} → ${v}`));
    }

    await page.evaluate(() =>
      localStorage.setItem("vulnera:a11y", JSON.stringify({ escalaFonte: 2, altoContraste: true })),
    );
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    achados.push(...(await varrer(page)).map((v) => `/dashboard (alto contraste, 200%) → ${v}`));
    expect(achados).toEqual([]);
  });
});
