/**
 * Confere transições, skeletons e expansão no app realmente renderizado.
 * Usa DTOs isolados no navegador para controlar espera/erro sem gravar no banco.
 * Consumidor: revisão das animações de projeto, finding e comentários.
 */
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { installNavigationFixtures } from "./install-navigation-fixtures.mjs";
const require = createRequire(new URL("../../../package.json", import.meta.url));
const { chromium } = require("playwright");
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: "no-preference" });
page.setDefaultTimeout(18000);
const { user, projects } = await installNavigationFixtures(page);
const stableMotion = process.argv.includes("--stable");
const date = "2026-10-09T12:00:00.000Z";
const finding = { id: "motion-finding", title: "Controle de acesso inconsistente", description: "A análise identificou uma diferença na validação de acesso. ".repeat(6),
  impact: "Dados internos podem ficar acessíveis fora do contexto previsto.", recommendation: "Validar autorização no servidor antes de responder aos pedidos.",
  projectId: projects[0].id, applicationId: projects[0].applicationId, companyId: user.companyId, createdBy: user.id, assignedTo: null,
  status: "OPEN", severityFinal: "HIGH", severityCalculated: "HIGH", severityOverrideReason: null, owaspCategory: "A01", cvssVector: "CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H", cvssScore: 8.8,
  createdAt: date, updatedAt: date };
const item = { ...finding, projectName: projects[0].name, applicationName: "Portal", companyName: user.name, slaState: "NO_SLA", slaDueAt: null, slaRemainingMs: null,
  vrsScore: null, vrsBand: null, hasActiveRiskAcceptance: false, assigneeName: null };
const comments = Array.from({ length: 21 }, (_, index) => ({ id: `motion-comment-${index}`, vulnerabilityId: finding.id, authorId: user.id,
  content: index === 0 ? "Comentário longo com orientações de validação e acompanhamento. ".repeat(14) : `Comentário ${index + 1} registrado para acompanhamento.`, createdAt: date }));
const controls = { evidenceError: true };
const requests = [];
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
await page.route("**/api/**", async route => {
  const url = new URL(route.request().url()); requests.push({ path: url.pathname, page: url.searchParams.get("page"), method: route.request().method() });
  let data, delay = 550, status = 200;
  if (url.pathname === "/api/projects") { data = projects; delay = 1100; }
  else if (url.pathname === `/api/projects/${projects[0].id}`) data = { ...projects[0], description: "Informações reais da análise aparecem nesta seção.", scopeIn: "Portal e API de integração autorizados." };
  else if (url.pathname === "/api/vulnerabilities") data = { data: [item], pagination: { page: 1, pageSize: 30, total: 1, totalPages: 1 }, facets: { severity: { HIGH: 1 }, status: { OPEN: 1 }, owasp: { A01: 1 }, company: {} } };
  else if (url.pathname === `/api/vulnerabilities/${finding.id}`) data = finding;
  else if (url.pathname.endsWith("/comments")) {
    const number = Number(url.searchParams.get("page") ?? 1); data = { items: comments.slice((number - 1) * 20, number * 20), page: number, pageSize: 20, total: 21 };
  } else if (url.pathname.endsWith("/evidences")) { data = controls.evidenceError ? { error: "INTERNAL_ERROR" } : []; status = controls.evidenceError ? 503 : 200; }
  else return route.fallback();
  await pause(delay); await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) });
});
const passed = [], errors = [], measurements = {};
page.on("pageerror", error => { if (!errors.includes(error.message)) errors.push(error.message); });
const local = name => new URL(`./${name}`, import.meta.url).pathname.replace(/^\/(\w:)/, "$1");
async function check(name, run) { await run(); passed.push(name); process.stdout.write(`OK ${name}\n`); }
async function trace(texts) {
  await page.evaluate(texts => {
    window.detailSamples = []; const start = performance.now();
    function sample(now) {
      const leaf = [...document.querySelectorAll("div, [role=heading]")].find(el => el.childElementCount === 0 && texts.includes(el.textContent) && el.getClientRects().length > 0);
      const transforms = [], opacity = [];
      for (let el = leaf; el; el = el.parentElement) {
        const style = getComputedStyle(el); transforms.push(new DOMMatrix(style.transform).e); opacity.push(Number(style.opacity));
      }
      window.detailSamples.push({ ms: now - start, x: transforms.sort((a,b) => Math.abs(b)-Math.abs(a))[0] ?? null, opacity });
      if (now - start < 1100) requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
  }, texts);
}
async function samples() { await pause(1200); return page.evaluate(() => window.detailSamples); }
async function heightTrace(testId) {
  await page.evaluate(testId => {
    window.heightSamples = []; const start = performance.now();
    function sample(now) {
      const element = document.querySelector(`[data-testid="${testId}"]`);
      window.heightSamples.push({ ms: now - start, height: element?.getBoundingClientRect().height ?? null });
      if (now - start < 650) requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
  }, testId);
}
const visible = locator => locator.filter({ visible: true });
try {
  await page.goto("http://localhost:8087", { waitUntil: "networkidle" });
  await page.getByLabel("E-mail", { exact: true }).fill(user.email);
  await page.getByLabel("Senha", { exact: true }).fill("isolated-preview");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await check("skeleton da Home dá lugar aos projetos", async () => {
    await page.getByTestId("skeleton-projects").waitFor(); await page.getByTestId("skeleton-metrics").waitFor();
    await page.screenshot({ path: local("detail-motion-home-loading.png") });
    await page.getByText("5 no total", { exact: true }).waitFor(); await pause(500);
    assert.equal(await page.getByTestId("skeleton-projects").count(), 0);
  });
  await check(stableMotion ? "projeto abre sem apagar o conteúdo ou crescer o painel inicial" : "projeto entra pela direita com skeleton e fade", async () => {
    await trace(stableMotion ? [projects[0].name] : ["PROJETO", "VISÃO DO PROJETO"]);
    await page.getByRole("button", { name: /Abrir projeto/ }).first().click(); await page.getByTestId("skeleton-project").waitFor();
    await visible(page.getByText("JORNADA DA ANÁLISE", { exact: true })).waitFor();
    const values = await samples(); measurements.project = values;
    if (stableMotion) {
      assert.ok(values.filter(value => value.opacity.length).every(value => value.opacity.every(opacity => opacity >= 0.92)));
      assert.equal(await page.getByTestId("disclosure-SOBRE A ANÁLISE").evaluate(el => getComputedStyle(el.firstElementChild).position), "relative");
    } else {
      assert.ok(values.some(value => value.x > 0.2 && value.x <= 28.1));
      assert.ok(values.some(value => value.opacity.some(opacity => opacity > 0 && opacity < 1)));
    }
    assert.ok(Math.abs(values.at(-1).x) < 0.1);
  });
  await check("informações do projeto recolhem com altura intermediária", async () => {
    const body = page.getByTestId("disclosure-SOBRE A ANÁLISE"); const initial = (await body.boundingBox()).height;
    assert.ok(initial > 50); await heightTrace("disclosure-SOBRE A ANÁLISE");
    await page.getByRole("button", { name: "SOBRE A ANÁLISE", exact: true }).click(); await pause(700);
    const values = await page.evaluate(() => window.heightSamples); assert.ok(values.some(value => value.height > 1 && value.height < initial - 1));
    assert.ok((await body.boundingBox()).height < 0.1); measurements.collapse = values;
    await page.getByRole("button", { name: "SOBRE A ANÁLISE", exact: true }).click(); await pause(400); assert.ok((await body.boundingBox()).height > 50);
  });
  await check(stableMotion ? "vulnerabilidade abre com skeleton e superfície visível" : "vulnerabilidade entra com skeleton e deslize curto", async () => {
    await visible(page.getByRole("button", { name: /Abrir detalhe/ })).first().waitFor();
    await trace(["VULNERABILIDADE"]); await visible(page.getByRole("button", { name: /Abrir detalhe/ })).first().click();
    await page.getByTestId("skeleton-finding").waitFor(); await visible(page.getByText("SEVERIDADE TÉCNICA", { exact: true })).waitFor();
    const values = await samples(); measurements.finding = values;
    if (stableMotion) assert.ok(values.filter(value => value.opacity.length).every(value => value.opacity.every(opacity => opacity >= 0.92)));
    else assert.ok(values.some(value => value.x > 0.2 && value.x <= 28.1));
    assert.ok(Math.abs(values.at(-1).x) < 0.1);
  });
  await check("descrição recolhe, expande e preserva o conteúdo", async () => {
    const toggle = page.getByRole("button", { name: "DESCRIÇÃO", exact: true }); await toggle.click(); await pause(400);
    assert.equal(await toggle.getAttribute("aria-expanded"), "false"); await toggle.click(); await pause(400);
    assert.equal(await toggle.getAttribute("aria-expanded"), "true"); assert.ok((await visible(page.getByTestId("disclosure-DESCRIÇÃO")).boundingBox()).height > 40);
  });
  await check("evidência mantém erro separado de vazio e permite retry", async () => {
    await page.getByRole("button", { name: "Evidências", exact: true }).click(); await page.getByTestId("skeleton-evidence").waitFor();
    await visible(page.getByText("Evidências indisponíveis", { exact: true })).waitFor(); assert.equal(await page.getByText("Nenhuma evidência anexada", { exact: true }).count(), 0);
    controls.evidenceError = false; await page.getByRole("button", { name: "Tentar novamente", exact: true }).click();
    await visible(page.getByText("Nenhuma evidência anexada", { exact: true })).waitFor();
  });
  await check("comentário longo expande e nova página permanece disponível", async () => {
    await page.getByRole("button", { name: "Comentários", exact: true }).click(); await page.getByTestId("skeleton-comments").waitFor();
    const toggle = page.getByRole("button", { name: "Texto do comentário", exact: true }).first(); await toggle.waitFor(); await pause(400);
    assert.equal(await toggle.getAttribute("aria-expanded"), "true"); await toggle.click(); await pause(400);
    assert.equal(await toggle.getAttribute("aria-expanded"), "false"); await toggle.click(); await pause(400);
    assert.equal(await toggle.getAttribute("aria-expanded"), "true");
    await page.getByRole("button", { name: "Carregar mais comentários", exact: true }).click();
    await visible(page.getByText("Comentário 21 registrado para acompanhamento.", { exact: true })).waitFor();
    assert.ok(requests.some(request => request.path.endsWith("/comments") && request.page === "2"));
  });
  await check("layout de detalhe em 320 px e movimento reduzido", async () => {
    await page.setViewportSize({ width: 320, height: 844 }); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.emulateMedia({ reducedMotion: "reduce" }); await pause(250); await page.getByRole("button", { name: "Resumo", exact: true }).click();
    const toggle = page.getByRole("button", { name: "DESCRIÇÃO", exact: true }); await toggle.click(); assert.equal(await toggle.getAttribute("aria-expanded"), "false");
    assert.ok((await page.getByTestId("disclosure-DESCRIÇÃO").boundingBox()).height < 0.1);
    await toggle.click(); assert.ok((await visible(page.getByTestId("disclosure-DESCRIÇÃO")).boundingBox()).height > 20);
    await page.getByRole("button", { name: "Voltar", exact: true }).click(); await visible(page.getByText("VISÃO DO PROJETO", { exact: true })).waitFor();
  });
  await check(stableMotion ? "retorno preserva Home visível e mantém abas" : "retorno traz Home pela esquerda e mantém abas", async () => {
    await page.emulateMedia({ reducedMotion: "no-preference" }); await pause(250);
    await trace(["Seus projetos"]); await page.getByRole("button", { name: "Voltar", exact: true }).click();
    const values = await samples(); measurements.returnHome = values;
    if (stableMotion) assert.ok(values.filter(value => value.opacity.length).every(value => value.opacity.every(opacity => opacity >= 0.92)));
    else assert.ok(values.some(value => value.x < -0.2 && value.x >= -28.1));
    assert.ok(Math.abs(values.at(-1).x) < 0.1);
    await page.getByRole("tab", { name: "Minha conta", exact: true }).click(); await visible(page.getByText("Seu perfil", { exact: true })).waitFor();
    await page.getByRole("tab", { name: "Projetos", exact: true }).click(); await visible(page.getByText("Seus projetos", { exact: true })).waitFor();
  });
  await check("sem exceções ou operações de escrita nos recursos", async () => {
    assert.deepEqual(errors, []); assert.ok(requests.filter(request => !request.path.startsWith("/api/auth/")).every(request => request.method === "GET"));
  });
  await writeFile(new URL(stableMotion ? "./stable-motion-results.json" : "./detail-motion-results.json", import.meta.url), JSON.stringify({ passed: passed.length, checks: passed, measurements, errors, api: "fixtures isoladas; sem API real", nativeAnimation: stableMotion ? "fora do alcance do navegador; validar no aparelho" : undefined }, null, 2));
} catch (error) {
  await page.screenshot({ path: local("detail-motion-failure.png") });
  await writeFile(new URL("./detail-motion-debug.json", import.meta.url), JSON.stringify({ passed, measurements, last: await page.evaluate(() => window.detailSamples), errors }, null, 2));
  throw error;
}
finally { await browser.close(); }
