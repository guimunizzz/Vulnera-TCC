/**
 * Confere a barra compacta real: seleção, teclado, troca rápida e movimento reduzido.
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
const shortSlide = process.argv.includes("--slide");
const artifactPrefix = shortSlide ? "short-slide-navigation" : process.argv.includes("--restored") ? "restored-icon-navigation" : "icon-navigation";
page.on("pageerror", (error) => errors.push(error.message));
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const home = page.getByRole("tab", { name: "Projetos", exact: true });
const account = page.getByRole("tab", { name: "Minha conta", exact: true });
const indicator = page.getByTestId("tab-selection-indicator");
async function x() { return indicator.evaluate((element) => new DOMMatrix(getComputedStyle(element).transform).e); }
async function check(name, run) { await run(); checks.push(name); process.stdout.write(`OK ${name}\n`); }
async function screenshot(name) { await page.screenshot({ path: new URL(`./${name.replace("icon-navigation", artifactPrefix)}.png`, import.meta.url).pathname.replace(/^\/(\w:)/, "$1") }); }
async function beginSamples() {
  await page.evaluate(() => {
    window.navigationSamples = [];
    const started = performance.now();
    function sample(now) {
      const indicator = document.querySelector('[data-testid="tab-selection-indicator"]');
      const profile = [...document.querySelectorAll("div")].find((element) => element.childElementCount === 0 && element.textContent === "Seu perfil");
      const icon = document.querySelector('[data-testid="tab-icon-settings-outline"]');
      const homeHeading = [...document.querySelectorAll('[role="heading"]')].find((element) => element.textContent.startsWith("Olá,"));
      function sceneX(element) {
        let x = 0;
        for (; element; element = element.parentElement) {
          const current = new DOMMatrix(getComputedStyle(element).transform).e;
          if (Math.abs(current) > Math.abs(x)) x = current;
        }
        return x;
      }
      const opacity = [];
      for (let element = profile; element && opacity.length < 12; element = element.parentElement) opacity.push(Number(getComputedStyle(element).opacity));
      window.navigationSamples.push({ ms: now - started, x: indicator ? new DOMMatrix(getComputedStyle(indicator).transform).e : null,
        scale: icon ? new DOMMatrix(getComputedStyle(icon).transform).a : null,
        profileX: sceneX(profile), homeX: sceneX(homeHeading), opacity });
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
  await check("cápsula e áreas de toque em 320/390 px", async () => {
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 }); await pause(100);
      const bar = await page.getByTestId("icon-glass-tab-bar").boundingBox(); assert.ok(bar && Math.abs(bar.width - 176) < 0.5 && Math.abs(bar.height - 56) < 0.5);
      assert.ok(Math.abs(bar.x + bar.width / 2 - width / 2) < 0.5);
      for (const button of [home, account]) { const bounds = await button.boundingBox(); assert.ok(bounds && bounds.width >= 48 && bounds.height >= 48); }
      assert.equal(await page.getByText("Minha conta", { exact: true }).count(), 0);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
      await screenshot(`icon-navigation-home-${width}`);
    }
    await page.setViewportSize({ width: 390, height: 844 });
  });
  await check("linha desliza e a tela faz fade", async () => {
    // Aquece a aba para separar fade de navegação da primeira entrada do conteúdo.
    await account.click(); await page.getByText("Seu perfil", { exact: true }).waitFor(); await pause(500);
    await home.click(); await pause(500); assert.ok(Math.abs(await x()) < 0.1);
    await beginSamples(); await account.click(); await pause(700);
    const samples = await page.evaluate(() => window.navigationSamples);
    assert.ok(samples.some((sample) => sample.x > 1 && sample.x < 78));
    assert.ok(Math.abs(await x() - 79) < 0.2);
    assert.ok(samples.some((sample) => sample.opacity.some((opacity) => opacity > 0.01 && opacity < 0.99)));
    if (process.argv.includes("--restored") || shortSlide) {
      assert.ok(samples.some((sample) => sample.scale > 1.01 && sample.scale < 1.099));
      const iconScale = (name) => page.getByTestId(`tab-icon-${name}`).evaluate((element) => new DOMMatrix(getComputedStyle(element).transform).a);
      assert.ok(Math.abs(await iconScale("settings-outline") - 1.1) < 0.001);
      assert.ok(Math.abs(await iconScale("folder-outline") - 1) < 0.001);
      assert.equal(await page.getByTestId("tab-light-sweep").count(), 0);
    }
    assert.equal(await account.getAttribute("aria-selected"), "true"); measurements.transition = samples;
    if (shortSlide) {
      assert.ok(samples.some((sample) => sample.profileX > 1 && sample.profileX <= 28), "Configurações deve entrar pela direita");
      assert.ok(samples.every((sample) => Math.abs(sample.profileX) <= 28.1));
      assert.ok(Math.abs(samples.at(-1).profileX) < 0.1);
      await beginSamples(); await home.click(); await pause(700);
      const reverse = await page.evaluate(() => window.navigationSamples);
      assert.ok(reverse.some((sample) => sample.homeX < -1 && sample.homeX >= -28), "Home deve entrar pela esquerda");
      assert.ok(reverse.every((sample) => Math.abs(sample.homeX) <= 28.1));
      assert.ok(Math.abs(reverse.at(-1).homeX) < 0.1);
      measurements.reverse = reverse;
    }
  });
  await check("teclado e trocas rápidas terminam na aba correta", async () => {
    await home.focus(); await home.press("Enter"); await pause(400); assert.equal(await home.getAttribute("aria-selected"), "true");
    for (let index = 0; index < 3; index++) { await account.click({ force: true }); await home.click({ force: true }); }
    await pause(500); assert.equal(await home.getAttribute("aria-selected"), "true"); assert.ok(Math.abs(await x()) < 0.2);
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
    assert.ok(Math.abs(await x() - 79) < 0.2); const fixed = await x(); await pause(120); assert.equal(await x(), fixed);
    await home.click(); assert.ok(Math.abs(await x()) < 0.2);
  });
  await check("saída remove barra e execução não tem exceções", async () => {
    await account.click(); await page.getByRole("button", { name: "Sair da conta", exact: true }).click();
    await page.getByRole("button", { name: "Confirmar saída", exact: true }).click(); await page.getByLabel("E-mail", { exact: true }).waitFor();
    assert.equal(await page.getByTestId("icon-glass-tab-bar").count(), 0); assert.deepEqual(errors, []);
  });
  await writeFile(new URL(`./${artifactPrefix}-results.json`, import.meta.url), JSON.stringify({ passed: checks.length, checks, measurements, errors, api: "fixtures isoladas, sem API real" }, null, 2));
} catch (error) { await screenshot("icon-navigation-failure"); throw error; }
finally { await browser.close(); }
