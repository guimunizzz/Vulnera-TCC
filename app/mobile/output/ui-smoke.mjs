/**
 * Smoke visual do app renderizado com a API real, em larguras de celular.
 * Exercita navegação, recuperação de erro e saída sem expor tokens nos logs.
 * Consumidor: capturas e relatório da refatoração; não é código de produção.
 */
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
const require = createRequire(new URL("../../../package.json", import.meta.url));
const { chromium } = require("playwright");
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
const page = await context.newPage();
page.setDefaultTimeout(30000);
const exceptions = [];
const responses = [];
page.on("pageerror", (error) => exceptions.push(error.message));
page.on("response", (response) => { const url = new URL(response.url()); if (url.pathname.startsWith("/api/")) responses.push({ path: url.pathname, status: response.status() }); });
const passed = [];
async function check(name, run) { await run(); passed.push(name); process.stdout.write(`OK ${name}\n`); }
async function screenshot(name) { await page.screenshot({ path: new URL(`./${name}.png`, import.meta.url).pathname.replace(/^\/(\w:)/, "$1"), fullPage: false }); }
try {
  await page.goto("http://localhost:8087", { waitUntil: "networkidle" });
  await page.getByPlaceholder("voce@empresa.com").fill("owner@technova.demo");
  await page.getByPlaceholder("••••••••").fill("demo12345");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await check("login e projetos reais", async () => { await page.getByText("5 no total", { exact: true }).waitFor(); });
  await screenshot("mobile-home-390");
  await check("busca vazia distinguida de erro", async () => {
    await page.getByRole("textbox", { name: "Buscar projetos pelo nome" }).fill("projeto-sem-correspondencia-qa");
    await page.getByText("Nenhum resultado", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Limpar busca" }).click();
  });
  await check("filtro de status", async () => {
    await page.getByRole("button", { name: "Concluídos", exact: true }).click();
    assert.ok(await page.getByRole("button", { name: /Abrir projeto/ }).count());
    await page.getByRole("button", { name: "Todos", exact: true }).click();
  });
  // Solicita páginas pequenas ao servidor real para exercitar o botão sem fixtures.
  await page.route("**/api/vulnerabilities?*", async (route) => {
    const url = new URL(route.request().url()); url.searchParams.set("pageSize", "1");
    const response = await route.fetch({ url: url.toString() }); await route.fulfill({ response });
  });
  await check("detalhe de projeto e facetas reais", async () => {
    await page.getByRole("button", { name: /Abrir projeto/ }).first().click();
    await page.getByText("JORNADA DA ANÁLISE", { exact: true }).waitFor();
    await page.getByRole("button", { name: /Abrir detalhe/ }).first().waitFor();
  });
  await screenshot("mobile-project-390");
  await check("paginação com segunda página real", async () => {
    await page.getByRole("button", { name: "Carregar mais vulnerabilidades", exact: true }).click();
    await page.getByText("Mostrando 2 de 2", { exact: true }).waitFor();
    assert.equal(await page.getByRole("button", { name: /Abrir detalhe/ }).count(), 2);
  });
  await check("detalhe de vulnerabilidade e CVSS", async () => {
    await page.getByRole("button", { name: /Abrir detalhe/ }).first().click();
    await page.getByText("SEVERIDADE TÉCNICA", { exact: true }).waitFor();
  });
  await screenshot("mobile-finding-390");
  await check("aba de comentários reais", async () => {
    await page.getByRole("button", { name: "Comentários", exact: true }).click();
    await page.getByText("Carregando comentários", { exact: true }).waitFor({ state: "hidden" });
    assert.ok(!await page.getByText("Comentários indisponíveis", { exact: true }).count());
  });
  await screenshot("mobile-comments-390");
  await check("erro de evidência não aparece como vazio", async () => {
    await page.route("**/api/vulnerabilities/*/evidences", (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "INTERNAL_ERROR" }) }));
    await page.getByRole("button", { name: "Evidências", exact: true }).click();
    await page.getByText("Evidências indisponíveis", { exact: true }).waitFor();
    assert.equal(await page.getByText("Nenhuma evidência anexada", { exact: true }).count(), 0);
    await screenshot("mobile-evidence-error-390");
    await page.unroute("**/api/vulnerabilities/*/evidences");
    await page.getByRole("button", { name: "Tentar novamente", exact: true }).click();
    await page.getByText("Evidências indisponíveis", { exact: true }).waitFor({ state: "hidden" });
    await page.getByText("Carregando evidências", { exact: true }).waitFor({ state: "hidden" });
  });
  await screenshot("mobile-evidence-390");
  await check("conta atualizada pela API", async () => {
    await page.getByRole("tab", { name: /Minha conta/ }).click();
    await page.getByText("owner@technova.demo", { exact: true }).waitFor();
    await page.getByText("MEMBRO DESDE", { exact: true }).waitFor();
    await page.getByText("Atualizando os dados da sua conta...", { exact: true }).waitFor({ state: "hidden" });
  });
  await screenshot("mobile-account-390");
  await check("layout em 320 px", async () => {
    await page.setViewportSize({ width: 320, height: 740 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    await screenshot("mobile-account-320");
  });
  await check("confirmação e cancelamento do logout", async () => {
    await page.getByRole("button", { name: "Sair da conta", exact: true }).click();
    await page.getByRole("button", { name: "Continuar no app", exact: true }).click();
    await page.getByText("owner@technova.demo", { exact: true }).waitFor();
  });
  await check("logout retorna ao login", async () => {
    await page.getByRole("button", { name: "Sair da conta", exact: true }).click();
    await page.getByRole("button", { name: "Confirmar saída", exact: true }).click();
    await page.getByPlaceholder("voce@empresa.com").waitFor();
  });
  await check("troca de conta consulta projetos novamente", async () => {
    const before = responses.filter((item) => item.path === "/api/projects" && item.status === 200).length;
    await page.getByPlaceholder("voce@empresa.com").fill("fernanda@technova.demo");
    await page.getByPlaceholder("••••••••").fill("demo12345");
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await page.getByText("5 no total", { exact: true }).waitFor();
    assert.ok(responses.filter((item) => item.path === "/api/projects" && item.status === 200).length > before);
    await page.getByRole("tab", { name: /Minha conta/ }).click();
    await page.getByText("fernanda@technova.demo", { exact: true }).waitFor();
    assert.equal(await page.getByText("owner@technova.demo", { exact: true }).count(), 0);
  });
  await check("nenhuma exceção de execução", async () => assert.deepEqual(exceptions, []));
  await writeFile(new URL("./ui-smoke-results.json", import.meta.url), JSON.stringify({ passed: passed.length, checks: passed, responses, exceptions }, null, 2));
  process.stdout.write(JSON.stringify({ passed: passed.length, checks: passed }, null, 2) + "\n");
} catch (error) {
  await screenshot("mobile-smoke-failure");
  await writeFile(new URL("./ui-smoke-failure.json", import.meta.url), JSON.stringify({ passed, exceptions, responses, error: error.message }, null, 2));
  throw error;
} finally { await browser.close(); }
