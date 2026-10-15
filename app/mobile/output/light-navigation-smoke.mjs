/**
 * Confere luz, pulsação e fade da opção 2 no componente real da barra glass.
 * Registra a animação no navegador sem afirmar desempenho nativo ou API real.
 * Consumidor: revisão visual do modelo 7, com capturas somente da Home.
 */
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { installNavigationFixtures } from "./install-navigation-fixtures.mjs";
const require = createRequire(new URL("../../../package.json", import.meta.url));
const { chromium } = require("playwright");
const browser = await chromium.launch({ headless: true, channel: "chrome", timeout: 30000 });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: "no-preference" });
page.setDefaultTimeout(15000);
const { user } = await installNavigationFixtures(page);
const checks = [], errors = [], measurements = {};
page.on("pageerror", (error) => errors.push(error.message));
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const home = page.getByRole("tab", { name: "Projetos", exact: true });
const account = page.getByRole("tab", { name: "Minha conta", exact: true });
const indicator = page.getByTestId("tab-light-sweep");
async function x() { return indicator.evaluate((element) => new DOMMatrix(getComputedStyle(element).transform).e); }
async function settled() {
  assert.equal(await indicator.evaluate((element) => Number(getComputedStyle(element).opacity)), 0);
  for (const name of ["folder-outline", "settings-outline"]) {
    assert.ok(Math.abs(await page.getByTestId(`tab-icon-${name}`).evaluate((element) => new DOMMatrix(getComputedStyle(element).transform).a) - 1) < 0.001);
  }
}
async function check(name, run) { await run(); checks.push(name); process.stdout.write(`OK ${name}\n`); }
async function screenshot(name) { await page.screenshot({ path: new URL(`./${name}.png`, import.meta.url).pathname.replace(/^\/(\w:)/, "$1") }); }
async function beginSamples() {
  await page.evaluate(() => {
    window.navigationSamples = [];
    const started = performance.now();
    function sample(now) {
      const indicator = document.querySelector('[data-testid="tab-light-sweep"]');
      const icon = document.querySelector('[data-testid="tab-icon-settings-outline"]');
      const homeIcon = document.querySelector('[data-testid="tab-icon-folder-outline"]');
      const profile = [...document.querySelectorAll("div")].find((element) => element.childElementCount === 0 && element.textContent === "Seu perfil");
      const opacity = [];
      for (let element = profile; element && opacity.length < 12; element = element.parentElement) opacity.push(Number(getComputedStyle(element).opacity));
      window.navigationSamples.push({ ms: now - started, x: indicator ? new DOMMatrix(getComputedStyle(indicator).transform).e : null,
        light: indicator ? Number(getComputedStyle(indicator).opacity) : null,
        scale: icon ? new DOMMatrix(getComputedStyle(icon).transform).a : null,
        homeScale: homeIcon ? new DOMMatrix(getComputedStyle(homeIcon).transform).a : null, opacity });
      if (now - started < 650) requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
  });
}
try {
  await page.goto("http://localhost:8087", { waitUntil: "networkidle" });
  await page.getByLabel("E-mail", { exact: true }).fill(user.email);
  await page.getByLabel("Senha", { exact: true }).fill("isolated-preview");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.getByText("5 no total", { exact: true }).waitFor(); await pause(450);
  await settled();
  await check("cápsula e áreas de toque em 320/390 px", async () => {
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 }); await pause(100);
      const bar = await page.getByTestId("icon-glass-tab-bar").boundingBox(); assert.ok(bar && Math.abs(bar.width - 176) < 0.5 && Math.abs(bar.height - 56) < 0.5);
      assert.ok(Math.abs(bar.x + bar.width / 2 - width / 2) < 0.5);
      for (const button of [home, account]) { const bounds = await button.boundingBox(); assert.ok(bounds && bounds.width >= 48 && bounds.height >= 48); }
      assert.equal(await page.getByText("Minha conta", { exact: true }).count(), 0);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
      await screenshot(`light-navigation-home-${width}`);
    }
    await page.setViewportSize({ width: 390, height: 844 });
  });
  await check("luz percorre vidro, ícone pulsa e tela faz fade", async () => {
    // Aquece a aba para separar fade de navegação da primeira entrada do conteúdo.
    await account.click(); await page.getByText("Seu perfil", { exact: true }).waitFor(); await pause(500);
    await home.click(); await pause(500); assert.ok(Math.abs(await x()) < 0.1);
    await beginSamples(); await account.click(); await pause(700);
    const samples = await page.evaluate(() => window.navigationSamples);
    assert.ok(samples.some((sample) => sample.x > 1 && sample.x < 78));
    assert.ok(samples.some((sample) => sample.light > 0.2 && sample.x > 1 && sample.x < 78));
    assert.ok(samples.some((sample) => sample.scale > 1.06 && sample.scale <= 1.121));
    assert.ok(Math.abs(await x() - 79) < 0.2);
    assert.ok(samples.some((sample) => sample.opacity.some((opacity) => opacity > 0.01 && opacity < 0.99)));
    assert.equal(await account.getAttribute("aria-selected"), "true"); measurements.transition = samples; await settled();
    await beginSamples(); await home.click(); await pause(700);
    const reverse = await page.evaluate(() => window.navigationSamples);
    assert.ok(reverse.some((sample) => sample.x > 1 && sample.x < 78 && sample.light > 0.2));
    assert.ok(reverse.some((sample) => sample.homeScale > 1.06));
    assert.ok(Math.abs(await x()) < 0.2); await settled(); measurements.reverse = reverse;
    await home.click(); await pause(120); await settled();
  });
  await check("teclado e trocas rápidas terminam na aba correta", async () => {
    await home.focus(); await home.press("Enter"); await pause(400); assert.equal(await home.getAttribute("aria-selected"), "true");
    for (let index = 0; index < 3; index++) { await account.click({ force: true }); await home.click({ force: true }); }
    await pause(500); assert.equal(await home.getAttribute("aria-selected"), "true"); assert.ok(Math.abs(await x()) < 0.2);
    await settled();
  });
  await check("avatar sincroniza seleção sem clicar na barra", async () => {
    await page.getByRole("button", { name: "Abrir minha conta", exact: true }).click(); await pause(500);
    assert.equal(await account.getAttribute("aria-selected"), "true"); assert.ok(Math.abs(await x() - 79) < 0.2);
    await home.click(); await pause(450);
  });
  await check("pilha do projeto preservada ao trocar de aba", async () => {
    await page.getByRole("button", { name: /Abrir projeto/ }).first().click(); await page.getByText("JORNADA DA ANÁLISE", { exact: true }).waitFor();
    await account.click(); await pause(450); await home.click(); await pause(450);
    await page.getByText("JORNADA DA ANÁLISE", { exact: true }).filter({ visible: true }).waitFor();
    assert.equal(await home.getAttribute("aria-selected"), "true"); await page.getByRole("button", { name: "Voltar", exact: true }).click(); await pause(400);
  });
  await check("movimento reduzido muda imediatamente", async () => {
    await page.emulateMedia({ reducedMotion: "reduce" }); await pause(200); await account.click();
    assert.ok(Math.abs(await x() - 79) < 0.2); const fixed = await x(); await pause(120); assert.equal(await x(), fixed); await settled();
    await home.click(); assert.ok(Math.abs(await x()) < 0.2); await settled();
  });
  await check("saída remove barra e execução não tem exceções", async () => {
    await account.click(); await page.getByRole("button", { name: "Sair da conta", exact: true }).click();
    await page.getByRole("button", { name: "Confirmar saída", exact: true }).click(); await page.getByLabel("E-mail", { exact: true }).waitFor();
    assert.equal(await page.getByTestId("icon-glass-tab-bar").count(), 0); assert.deepEqual(errors, []);
  });
  await writeFile(new URL("./light-navigation-results.json", import.meta.url), JSON.stringify({ passed: checks.length, checks, measurements, errors, api: "fixtures isoladas, sem API real" }, null, 2));
} catch (error) { await screenshot("light-navigation-failure"); throw error; }
finally { await browser.close(); }
