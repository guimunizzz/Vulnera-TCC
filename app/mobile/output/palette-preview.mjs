/**
 * Confere a paleta grafite nas telas reais do mobile com dados de teste isolados.
 * Existe para revisar cores com o Docker desligado; não comprova a API real.
 * Consumidor: capturas e relatório desta revisão, sem participar do aplicativo.
 */
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
const require = createRequire(new URL("../../../package.json", import.meta.url));
const { chromium } = require("playwright");
const browser = await chromium.launch({ headless: true, channel: "chrome", timeout: 30000 });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
page.setDefaultTimeout(20000);
const timestamp = "2026-10-06T12:00:00.000Z";
const user = { id: "preview-client", name: "TechNova", email: "preview@example.test", role: "CLIENT", companyId: "preview-company", createdAt: timestamp };
const projects = ["IN_REVIEW", "COMPLETED", "IN_PROGRESS", "IN_PROGRESS", "IN_REVIEW"].map((status, index) => ({
  id: `preview-project-${index}`, name: ["Pentest Web — Portal do Cliente", "Auditoria Interna — Sistema de Gestão", "Análise — Aplicativo Mobile", "Pentest — API de Integração", "Análise — Portal Administrativo"][index],
  description: null, applicationId: `preview-app-${index}`, companyId: user.companyId, analysisType: index === 1 ? "COMBO" : "DAST", analysisLevel: "INTERMEDIATE", hasRemediation: true,
  scopeIn: "Portal do cliente e serviços da aplicação.", scopeOut: "Serviços de terceiros.", notes: null, status, requestedAt: timestamp, startedAt: timestamp, closedAt: status === "COMPLETED" ? timestamp : null, updatedAt: timestamp,
}));
const findings = [
  ["CRITICAL", 9.8, "Injeção SQL na consulta de clientes", "#fda4af"],
  ["HIGH", 8.1, "Controle de acesso insuficiente", "#fdba74"],
  ["MEDIUM", 5.4, "Configuração de segurança incompleta", "#fde68a"],
  ["LOW", 3.1, "Cookie de sessão sem flag Secure", "#7dd3fc"],
  ["NONE", null, "Cabeçalho informativo do servidor", "#d4d4d8"],
].map(([severity, score, title, expected], index) => ({
  id: `preview-finding-${index}`, title, severityCalculated: severity, severityFinal: severity, cvssScore: score, expected, status: index === 3 ? "CLOSED" : "OPEN", owaspCategory: "A05",
  createdAt: timestamp, updatedAt: timestamp, projectId: projects[0].id, projectName: projects[0].name, applicationId: projects[0].applicationId, applicationName: "Portal do Cliente", companyId: user.companyId, companyName: user.name,
  description: "A análise identificou uma configuração que precisa de revisão para proteger os dados da aplicação.", impact: "Pode permitir acesso indevido a informações da aplicação.", recommendation: "Revise a configuração e valide os controles de segurança.", cvssVector: null, severityOverrideReason: null, createdBy: user.id, assignedTo: null,
  slaState: "NO_SLA", slaDueAt: null, slaRemainingMs: null, vrsScore: null, vrsBand: null, hasActiveRiskAcceptance: false, assigneeName: null,
}));
const checks = [], exceptions = [];
page.on("pageerror", (error) => exceptions.push(error.message));
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function capture(name) { await page.screenshot({ path: new URL(`./${name}.png`, import.meta.url).pathname.replace(/^\/(\w:)/, "$1") }); }
async function check(name, run) { await run(); checks.push(name); process.stdout.write(`OK ${name}\n`); }
async function bounds() { assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)); }
await page.route("**/api/**", async (route) => {
  const url = new URL(route.request().url()); const pathname = url.pathname;
  let data;
  if (pathname === "/api/auth/login") data = { user, accessToken: "isolated-preview-token", refreshToken: "isolated-preview-refresh" };
  else if (pathname === "/api/users/me") data = user;
  else if (pathname === "/api/users") data = [user];
  else if (pathname === "/api/projects") data = projects;
  else if (pathname.startsWith("/api/projects/")) data = projects.find((item) => pathname.endsWith(item.id));
  else if (pathname === "/api/vulnerabilities") data = { data: findings, pagination: { page: 1, pageSize: 30, total: 5, totalPages: 1 }, facets: { severity: { CRITICAL: 1, HIGH: 1, MEDIUM: 1, LOW: 1, NONE: 1 }, status: {}, company: {}, owasp: {} } };
  else if (pathname.endsWith("/evidences")) data = [{ id: "preview-evidence", originalName: "relatorio-tecnico.pdf", mimeType: "application/pdf", sizeBytes: 16384, proof: "Documento de apoio à revisão.", createdAt: timestamp }];
  else if (pathname.endsWith("/comments")) data = { items: [{ id: "preview-comment", authorId: user.id, content: "A correção está em revisão pela equipe responsável.", createdAt: timestamp }], page: 1, pageSize: 20, total: 1 };
  else if (pathname.startsWith("/api/vulnerabilities/")) data = findings.find((item) => pathname.endsWith(item.id));
  await route.fulfill({ status: data ? 200 : 404, contentType: "application/json", body: JSON.stringify(data ?? { error: "NOT_FOUND" }) });
});
try {
  await page.goto("http://localhost:8087", { waitUntil: "networkidle" });
  await page.getByLabel("E-mail", { exact: true }).fill(user.email); await page.getByLabel("Senha", { exact: true }).fill("isolated-preview");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.getByText("5 no total", { exact: true }).waitFor();
  await check("Home grafite em 390 e 320 px", async () => {
    for (const width of [390, 320]) { await page.setViewportSize({ width, height: 844 }); await bounds(); await capture(`palette-home-${width}`); }
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: /Abrir projeto/ }).first().click();
  await check("projeto com status e severidades em destaque", async () => { await page.getByText("JORNADA DA ANÁLISE", { exact: true }).waitFor(); await bounds(); await capture("palette-project-390"); });
  await check("CVSS com cores de todos os níveis e nota ausente", async () => {
    for (const finding of findings) {
      await page.getByRole("button", { name: new RegExp(finding.title + ", severidade") }).click();
      const ring = page.getByLabel(finding.cvssScore == null ? "CVSS não informado" : `CVSS ${finding.cvssScore.toFixed(1)} de 10`, { exact: true }); await ring.waitFor();
      const arc = ring.locator("circle").nth(1);
      if (finding.cvssScore != null) assert.equal(await arc.getAttribute("stroke"), finding.expected); else assert.equal(await ring.locator("circle").count(), 1);
      await bounds(); await capture(`palette-finding-${finding.severityCalculated.toLowerCase()}-390`);
      if (finding.severityCalculated === "LOW") {
        await page.setViewportSize({ width: 320, height: 844 }); await bounds(); await capture("palette-finding-low-320"); await page.setViewportSize({ width: 390, height: 844 });
        await page.getByRole("button", { name: "Evidências", exact: true }).click(); await page.getByText("Arquivo anexado", { exact: true }).waitFor(); await capture("palette-evidence-390");
        await page.getByRole("button", { name: "Comentários", exact: true }).click(); await page.getByText("A correção está em revisão pela equipe responsável.", { exact: true }).waitFor(); await capture("palette-comments-390");
      }
      await page.getByRole("button", { name: "Voltar", exact: true }).click(); await page.getByText("JORNADA DA ANÁLISE", { exact: true }).waitFor();
    }
  });
  await page.getByRole("tab", { name: /Minha conta/ }).click();
  await check("conta com vidro e ícones neutros", async () => { await page.getByText(user.email, { exact: true }).waitFor(); await bounds(); await capture("palette-account-390"); });
  await check("movimento preservado fora do modo reduzido", async () => {
    await page.getByRole("tab", { name: /Projetos/ }).click();
    // A aba conserva a pilha do projeto; voltar à Home antes de conferir filtros.
    await page.getByRole("button", { name: "Voltar", exact: true }).click();
    await page.getByText("5 no total", { exact: true }).filter({ visible: true }).waitFor();
    await page.emulateMedia({ reducedMotion: "no-preference" }); await pause(200);
    const button = page.getByRole("button", { name: "Todos", exact: true }); await button.hover(); await page.mouse.down(); await pause(140);
    const pressed = await button.evaluate((element) => new DOMMatrix(getComputedStyle(element).transform).a); assert.ok(pressed < 0.999 && pressed >= 0.98);
    await page.mouse.up(); await pause(600); const released = await button.evaluate((element) => new DOMMatrix(getComputedStyle(element).transform).a); assert.ok(Math.abs(released - 1) < 0.001);
  });
  await check("sem exceções de execução", async () => assert.deepEqual(exceptions, []));
  await writeFile(new URL("./palette-preview-results.json", import.meta.url), JSON.stringify({ passed: checks.length, checks, dataSource: "fixtures de revisão visual; Docker e API indisponíveis", exceptions }, null, 2));
} catch (error) { await capture("palette-preview-failure"); throw error; }
finally { await browser.close(); }
