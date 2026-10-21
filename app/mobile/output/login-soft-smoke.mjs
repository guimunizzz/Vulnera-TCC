/**
 * Confere suavidade do login e preservação do fluxo com a API real.
 * Exercita toque, teclado, carregamento, erro, acessibilidade e autenticação.
 * Consumidor: relatório e capturas desta revisão, sem fixtures no aplicativo.
 */
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
const require = createRequire(new URL("../../../package.json", import.meta.url));
const { chromium } = require("playwright");
const browser = await chromium.launch({ headless: true, channel: "chrome", timeout: 30000 });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: "no-preference" });
page.setDefaultTimeout(20000);
const checks = [], errors = [], measurements = {};
let requests = 0;
let releaseLogin;
const loginGate = new Promise((resolve) => { releaseLogin = resolve; });
let holdLogin = true;
page.on("pageerror", (error) => errors.push(error.message));
page.on("request", (request) => { if (new URL(request.url()).pathname === "/api/auth/login") requests++; });
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const enter = page.getByRole("button", { name: "Entrar", exact: true });
const email = page.getByPlaceholder("voce@empresa.com");
const password = page.getByPlaceholder("••••••••");
async function check(name, run) { await run(); checks.push(name); process.stdout.write(`OK ${name}\n`); }
async function scale() { return enter.evaluate((element) => new DOMMatrix(getComputedStyle(element).transform).a); }
async function cursorOpacity() { return page.getByTestId("login-cursor").evaluate((element) => Number(getComputedStyle(element).opacity)); }
async function capture(name) { await page.screenshot({ path: new URL(`./${name}.png`, import.meta.url).pathname.replace(/^\/(\w:)/, "$1") }); }
try {
  await page.goto("http://localhost:8087", { waitUntil: "networkidle" });
  await check("estado inicial e áreas de toque", async () => {
    assert.ok(await enter.isDisabled());
    for (const control of [email, password, enter]) {
      const bounds = await control.boundingBox(); assert.ok(bounds && bounds.height >= 47.5);
    }
  });
  await check("Enter do e-mail avança para senha", async () => {
    await email.fill("owner@technova.demo"); await email.press("Enter");
    assert.ok(await password.evaluate((element) => element === document.activeElement));
    await password.fill("senha-incorreta-qa");
  });
  await check("foco muda gradualmente e retorna", async () => {
    await email.click(); await pause(300);
    const focused = await email.evaluate((element) => getComputedStyle(element.parentElement).borderTopColor);
    measurements.emailFocused = await email.evaluate((element) => ({ active: element === document.activeElement, parent: element.parentElement.tagName }));
    await password.click(); await pause(300);
    const idle = await email.evaluate((element) => getComputedStyle(element.parentElement).borderTopColor);
    assert.notEqual(focused, idle); measurements.focus = { focused, idle };
  });
  await page.route("**/api/auth/login", async (route) => { if (holdLogin) await loginGate; await route.continue(); });
  await check("toque leve, carregamento e envio único", async () => {
    await enter.hover(); await page.mouse.down(); await pause(140);
    const pressed = await scale(); assert.ok(pressed < 0.999 && pressed >= 0.98);
    await page.mouse.up();
    await enter.waitFor({ state: "visible" });
    for (let attempt = 0; attempt < 30 && !await enter.isDisabled(); attempt++) await pause(100);
    assert.ok(await enter.isDisabled());
    measurements.busy = await enter.evaluate((element) => ({ busy: element.getAttribute("aria-busy"), disabled: element.getAttribute("aria-disabled") }));
    assert.equal(measurements.busy.busy, "true");
    await password.press("Enter"); await password.press("Enter");
    await pause(600); const released = await scale(); assert.ok(Math.abs(released - 1) < 0.001);
    measurements.press = { pressed, released };
    holdLogin = false; releaseLogin();
    await page.getByRole("alert").waitFor(); assert.equal(requests, 1);
  });
  await check("erro real mantém formulário acessível", async () => {
    assert.equal(await page.getByRole("alert").textContent(), "E-mail ou senha incorretos.");
    assert.ok(!await enter.isDisabled()); await capture("login-soft-error-390");
  });
  await check("cursor suave e movimento reduzido ao vivo", async () => {
    const start = await cursorOpacity(); await pause(700); const end = await cursorOpacity();
    assert.ok(Math.abs(end - start) > 0.005); measurements.cursor = { start, end };
    await page.emulateMedia({ reducedMotion: "reduce" }); await pause(200);
    const fixed = await cursorOpacity(); await pause(250); assert.equal(await cursorOpacity(), fixed);
    await enter.hover(); await page.mouse.down(); await pause(140); assert.equal(await scale(), 1);
    await page.mouse.move(4, 4); await page.mouse.up();
  });
  await check("formulário em 320 e 390 px", async () => {
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
      for (const control of [email, password, enter]) { const bounds = await control.boundingBox(); assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= width); }
      await capture(`login-soft-${width}`);
    }
  });
  await check("Enter da senha autentica CLIENT na API real", async () => {
    await password.fill("demo12345"); await password.press("Enter");
    await page.getByText("5 no total", { exact: true }).waitFor();
    assert.equal(requests, 2); assert.equal(await page.getByRole("alert").count(), 0);
  });
  await check("execução sem exceções", async () => assert.deepEqual(errors, []));
  await writeFile(new URL("./login-soft-results.json", import.meta.url), JSON.stringify({ passed: checks.length, checks, measurements, errors }, null, 2));
} catch (error) {
  await capture("login-soft-failure");
  await writeFile(new URL("./login-soft-failure.json", import.meta.url), JSON.stringify({ checks, measurements, errors, message: error.message }, null, 2));
  throw error;
} finally { releaseLogin(); await browser.close(); }
