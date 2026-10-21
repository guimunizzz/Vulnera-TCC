/**
 * Confere movimento real, áreas de toque e layouts no preview do mobile.
 * Usa API real e Chrome; registra limites sem alegar desempenho nativo.
 * Consumidor: revisão do refinamento visual solicitado pelo usuário.
 */
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
const require = createRequire(new URL("../../../package.json", import.meta.url));
const { chromium } = require("playwright");
const browser = await chromium.launch({ headless: true, channel: "chrome", timeout: 30000 });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: "no-preference" });
page.setDefaultTimeout(30000);
const errors = [];
const checks = [];
const measurements = {};
page.on("pageerror", (error) => errors.push(error.message));
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function check(name, run) { await run(); checks.push(name); process.stdout.write(`OK ${name}\n`); }
async function matrix(locator) { return locator.evaluate((element) => { const value = new DOMMatrix(getComputedStyle(element).transform); return { scale: value.a, x: value.e, y: value.f }; }); }
async function capture(name) { await page.screenshot({ path: new URL(`./${name}.png`, import.meta.url).pathname.replace(/^\/(\w:)/, "$1") }); }
async function controls() {
  const sizes = await page.getByRole("button").evaluateAll((elements) => elements.map((element) => { const rect = element.getBoundingClientRect(); return { label: element.getAttribute("aria-label") ?? element.textContent, width: rect.width, height: rect.height }; }).filter((rect) => rect.width && rect.height));
  for (const rect of sizes) { assert.ok(rect.width >= 47.5 && rect.height >= 47.5, JSON.stringify(rect)); }
  return sizes;
}
try {
  await page.goto("http://localhost:8087", { waitUntil: "networkidle" });
  await page.getByPlaceholder("voce@empresa.com").fill("owner@technova.demo");
  await page.getByPlaceholder("••••••••").fill("demo12345");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.getByText("5 no total", { exact: true }).waitFor();
  await pause(500);
  const atmosphere = page.getByTestId("workspace-atmosphere").first();
  await check("fundo apresenta movimento discreto", async () => {
    const start = await matrix(atmosphere); await pause(900); const end = await matrix(atmosphere);
    assert.ok(Math.abs(end.y - start.y) > 0.02); assert.ok(Math.abs(end.y) <= 14.1);
    measurements.ambient = { start, end };
  });
  await check("toque comprime e retorna sem salto", async () => {
    const button = page.getByRole("button", { name: "Todos", exact: true });
    await button.hover(); await page.mouse.down(); await pause(140);
    const pressed = await matrix(button); assert.ok(pressed.scale < 0.999 && pressed.scale >= 0.98);
    await page.mouse.up(); await pause(600); const released = await matrix(button);
    assert.ok(Math.abs(released.scale - 1) < 0.001); measurements.press = { pressed, released };
  });
  await check("atmosfera da tela anterior para ao trocar de aba", async () => {
    await page.getByRole("tab", { name: /Minha conta/ }).click();
    await page.getByText("owner@technova.demo", { exact: true }).waitFor(); await pause(300);
    const stopped = await matrix(atmosphere); await pause(250); assert.deepEqual(await matrix(atmosphere), stopped);
    assert.equal(stopped.y, 0); assert.equal(stopped.x, 0);
    await page.getByRole("tab", { name: /Projetos/ }).click(); await pause(400);
  });
  await check("áreas de toque têm no mínimo 48 px no preview", async () => { measurements.homeControls = await controls(); });
  await capture("mobile-soft-home-390");
  await check("rolagem move fundo sem deslocar conteúdo de toque", async () => {
    await page.emulateMedia({ reducedMotion: "reduce" }); await pause(150);
    const before = await matrix(atmosphere);
    await page.mouse.move(250, 620); await page.mouse.wheel(0, 250); await pause(300);
    assert.deepEqual(await matrix(atmosphere), before);
    await page.emulateMedia({ reducedMotion: "no-preference" }); await pause(150);
    const moving = await matrix(atmosphere); assert.ok(moving.y < -5); measurements.scrolled = moving;
  });
  await check("movimento reduzido desliga fundo e compressão ao vivo", async () => {
    await page.emulateMedia({ reducedMotion: "reduce" }); await pause(200);
    const start = await matrix(atmosphere); await pause(250); assert.deepEqual(await matrix(atmosphere), start);
    assert.equal(start.y, 0); assert.equal(start.x, 0);
    const button = page.getByRole("button", { name: "Todos", exact: true }); await button.hover(); await page.mouse.down(); await pause(140);
    assert.equal((await matrix(button)).scale, 1); await page.mouse.up();
  });
  await check("Home se adapta a 320 e 430 px", async () => {
    for (const width of [320, 430]) {
      await page.setViewportSize({ width, height: 844 });
      await page.getByRole("textbox", { name: "Buscar projetos pelo nome" }).scrollIntoViewIfNeeded();
      await pause(150); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
      await controls(); await capture(`mobile-soft-home-${width}`);
    }
  });
  await page.setViewportSize({ width: 320, height: 844 });
  await page.getByRole("button", { name: /Abrir projeto/ }).first().click();
  await page.getByText("JORNADA DA ANÁLISE", { exact: true }).waitFor();
  await check("detalhes legíveis em 320 px", async () => {
    await controls(); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)); await capture("mobile-soft-project-320");
    await page.getByRole("button", { name: /Abrir detalhe/ }).first().click();
    await page.getByText("SEVERIDADE TÉCNICA", { exact: true }).waitFor();
    for (const name of ["Resumo", "Evidências", "Comentários"]) {
      const bounds = await page.getByRole("button", { name, exact: true }).boundingBox();
      assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= 320);
    }
    await controls(); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)); await capture("mobile-soft-finding-320");
  });
  await check("sem exceções de execução", async () => assert.deepEqual(errors, []));
  await writeFile(new URL("./motion-smoke-results.json", import.meta.url), JSON.stringify({ passed: checks.length, checks, measurements, errors }, null, 2));
} catch (error) {
  await capture("mobile-soft-failure");
  await writeFile(new URL("./motion-smoke-failure.json", import.meta.url), JSON.stringify({ checks, measurements, errors, message: error.message }, null, 2));
  throw error;
} finally { await browser.close(); }
