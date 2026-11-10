/**
 * exposure-graph.test.ts
 *
 * Testes do Exposure Graph (D8): GET /api/companies/me/exposure-graph.
 *
 * ESTRATÉGIA
 * Todo cenário usa DATAS EXPLÍCITAS e contagens escolhidas à mão, para que cada
 * número esperado possa ser conferido por aritmética no comentário, e não
 * contra o próprio código.
 *
 *   EXG-01  happy path  · contagens por severidade, resolvidas, pior severidade
 *   EXG-02  categorias  · a mesma categoria aparece em duas aplicações; ordem
 *   EXG-03  principais  · no máximo 5, mais grave primeiro, mais antiga primeiro
 *   EXG-04  ordem       · aplicações por pior severidade, depois por abertas
 *   EXG-05  inativa     · aplicação desativada não aparece e seus achados não vazam
 *   EXG-06  borda       · company sem aplicações devolve lista vazia
 *
 *   TEN-18  isolamento  · dados da company B nunca aparecem para a company A
 *
 *   AUT-01  usuário sem company → 404 COMPANY_NOT_FOUND
 *   AUT-02  sem token → 401
 *
 * RATE LIMIT
 * O bucket `expensive` tem burst de 3 por usuário. Cada teste usa no máximo uma
 * ou duas chamadas por usuário, para não depender do limite.
 */

import request from "supertest";
import { app } from "../../src/app";
import { cleanDatabase } from "../setup";
import { seedUser } from "../fixtures/users.fixture";
import { seedPlan } from "../fixtures/plans.fixture";
import { seedCompany } from "../fixtures/companies.fixture";
import { seedApplication } from "../fixtures/applications.fixture";
import { seedProject } from "../fixtures/projects.fixture";
import { seedVulnerability } from "../fixtures/vulnerabilities.fixture";
import { loginAs } from "../fixtures/auth.fixture";

const SENHA = "senha12345";
const DIA_MS = 86_400_000;
const ROTA = "/api/companies/me/exposure-graph";

/** Data a N dias atrás, ao meio-dia UTC — deixa a ordem por data previsível. */
function diasAtras(n: number): Date {
  const d = new Date(Date.now() - n * DIA_MS);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0, 0));
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

/** Cenário base: uma company, um dono (CLIENT OWNER) e um analista. Sem aplicações. */
async function cenario() {
  const plan = await seedPlan({ name: "PRO" });
  const company = await seedCompany({ name: "TechNova Teste", planId: plan.id });
  const owner = await seedUser({
    name: "Dona",
    email: "dona@teste.com",
    password: SENHA,
    role: "CLIENT",
    companyId: company.id,
    companyRole: "OWNER",
  });
  const pentester = await seedUser({ name: "Analista", email: "analista@teste.com", password: SENHA, role: "PENTESTER" });
  const token = await loginAs(app, owner.email, SENHA);
  return { plan, company, owner, pentester, token };
}

type Cenario = Awaited<ReturnType<typeof cenario>>;

/** Cria uma aplicação com projeto próprio, como a API faria. */
async function aplicacao(companyId: string, dados: Omit<Parameters<typeof seedApplication>[0], "companyId">) {
  const application = await seedApplication({ ...dados, companyId });
  const projeto = await seedProject({ name: "Análise", applicationId: application.id, companyId });
  return { application, projetoId: projeto.id };
}

/** Um achado com data controlada. `diasAtras` é quantos dias atrás foi criado. */
async function achado(
  c: Cenario,
  alvo: { application: { id: string; companyId: string }; projetoId: string },
  dados: { titulo: string; severidade: string; status: string; owasp: string; diasAtras: number },
) {
  return seedVulnerability({
    projectId: alvo.projetoId,
    applicationId: alvo.application.id,
    companyId: alvo.application.companyId,
    createdBy: c.pentester.id,
    title: dados.titulo,
    owaspCategory: dados.owasp,
    severityCalculated: dados.severidade,
    severityFinal: dados.severidade,
    status: dados.status,
    createdAt: diasAtras(dados.diasAtras),
  });
}

describe("Exposure Graph (D8)", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  /* ====================================================================
     Corretude
     ==================================================================== */

  it("EXG-01 — conta abertas por severidade, resolvidas e pior severidade", async () => {
    const c = await cenario();
    const portal = await aplicacao(c.company.id, {
      name: "Portal",
      url: "https://portal.exemplo.com",
      environment: "PROD",
      criticality: "CRITICAL",
      internetFacing: true,
      dataSensitivity: "CONFIDENTIAL",
    });

    // Abertas (OPEN/IN_PROGRESS), exceto NONE: CRITICAL 2, HIGH 2, MEDIUM 1, LOW 1 → 6.
    await achado(c, portal, { titulo: "SQLi no login", severidade: "CRITICAL", status: "OPEN", owasp: "A03", diasAtras: 10 });
    await achado(c, portal, { titulo: "IDOR em pedidos", severidade: "CRITICAL", status: "IN_PROGRESS", owasp: "A01", diasAtras: 9 });
    await achado(c, portal, { titulo: "XSS refletido", severidade: "HIGH", status: "OPEN", owasp: "A03", diasAtras: 8 });
    await achado(c, portal, { titulo: "Sessão sem expiração", severidade: "HIGH", status: "OPEN", owasp: "A07", diasAtras: 2 });
    await achado(c, portal, { titulo: "Cabeçalhos ausentes", severidade: "MEDIUM", status: "OPEN", owasp: "A05", diasAtras: 7 });
    await achado(c, portal, { titulo: "Versão de banner", severidade: "LOW", status: "OPEN", owasp: "A05", diasAtras: 6 });
    // NONE (CVSS 0) não entra no grafo.
    await achado(c, portal, { titulo: "Informativo", severidade: "NONE", status: "OPEN", owasp: "A06", diasAtras: 5 });
    // Resolvidas (FIXED/CLOSED): 3.
    await achado(c, portal, { titulo: "Já corrigida 1", severidade: "HIGH", status: "FIXED", owasp: "A07", diasAtras: 5 });
    await achado(c, portal, { titulo: "Já corrigida 2", severidade: "CRITICAL", status: "CLOSED", owasp: "A03", diasAtras: 4 });
    await achado(c, portal, { titulo: "Já corrigida 3", severidade: "MEDIUM", status: "FIXED", owasp: "A03", diasAtras: 3 });

    const res = await request(app).get(ROTA).set(auth(c.token));

    expect(res.status).toBe(200);
    expect(res.body.companyId).toBe(c.company.id);
    expect(new Date(res.body.geradoEm).toISOString()).toBe(res.body.geradoEm);

    const p = res.body.aplicacoes[0];
    expect(p.id).toBe(portal.application.id);
    expect(p.name).toBe("Portal");
    expect(p.url).toBe("https://portal.exemplo.com");
    expect(p.environment).toBe("PROD");
    expect(p.criticality).toBe("CRITICAL");
    expect(p.internetFacing).toBe(true);
    expect(p.dataSensitivity).toBe("CONFIDENTIAL");

    expect(p.abertas).toEqual({ CRITICAL: 2, HIGH: 2, MEDIUM: 1, LOW: 1 });
    expect(p.totalAbertas).toBe(6);
    expect(p.totalResolvidas).toBe(3);
    expect(p.piorSeveridade).toBe("CRITICAL");
  });

  it("EXG-02 — categorias: uma linha por categoria com abertas, pior severidade e ordem", async () => {
    const c = await cenario();
    const portal = await aplicacao(c.company.id, { name: "Portal", criticality: "CRITICAL" });
    const intranet = await aplicacao(c.company.id, { name: "Intranet", criticality: "LOW" });

    await achado(c, portal, { titulo: "SQLi no login", severidade: "CRITICAL", status: "OPEN", owasp: "A03", diasAtras: 10 });
    await achado(c, portal, { titulo: "XSS refletido", severidade: "HIGH", status: "OPEN", owasp: "A03", diasAtras: 8 });
    await achado(c, portal, { titulo: "IDOR em pedidos", severidade: "CRITICAL", status: "IN_PROGRESS", owasp: "A01", diasAtras: 9 });
    await achado(c, portal, { titulo: "Sessão sem expiração", severidade: "HIGH", status: "OPEN", owasp: "A07", diasAtras: 2 });
    await achado(c, portal, { titulo: "Cabeçalhos ausentes", severidade: "MEDIUM", status: "OPEN", owasp: "A05", diasAtras: 7 });
    await achado(c, portal, { titulo: "Versão de banner", severidade: "LOW", status: "OPEN", owasp: "A05", diasAtras: 6 });
    // Resolvida na mesma categoria: não pode contar como aberta.
    await achado(c, portal, { titulo: "Corrigida A03", severidade: "CRITICAL", status: "FIXED", owasp: "A03", diasAtras: 4 });
    // A03 também existe na Intranet: a categoria aparece nas duas aplicações.
    await achado(c, intranet, { titulo: "Injeção em relatório", severidade: "HIGH", status: "OPEN", owasp: "A03", diasAtras: 4 });

    const res = await request(app).get(ROTA).set(auth(c.token));
    expect(res.status).toBe(200);

    const [pDoGrafo, iDoGrafo] = res.body.aplicacoes;
    expect(pDoGrafo.name).toBe("Portal");
    expect(iDoGrafo.name).toBe("Intranet");

    // Conferência: A03 = {CRITICAL, HIGH} = 2 abertas, pior CRITICAL.
    //   A01 = {CRITICAL} = 1. A07 = {HIGH} = 1. A05 = {MEDIUM, LOW} = 2, pior MEDIUM.
    // Ordem: pior severidade primeiro; empate (CRITICAL) → mais abertas primeiro.
    expect(pDoGrafo.categorias).toEqual([
      { owaspCategory: "A03", abertas: 2, piorSeveridade: "CRITICAL" },
      { owaspCategory: "A01", abertas: 1, piorSeveridade: "CRITICAL" },
      { owaspCategory: "A07", abertas: 1, piorSeveridade: "HIGH" },
      { owaspCategory: "A05", abertas: 2, piorSeveridade: "MEDIUM" },
    ]);

    expect(iDoGrafo.categorias).toEqual([{ owaspCategory: "A03", abertas: 1, piorSeveridade: "HIGH" }]);
  });

  it("EXG-03 — principais: no máximo 5, mais grave primeiro, depois a mais antiga", async () => {
    const c = await cenario();
    const portal = await aplicacao(c.company.id, { name: "Portal", criticality: "CRITICAL" });

    await achado(c, portal, { titulo: "SQLi no login", severidade: "CRITICAL", status: "OPEN", owasp: "A03", diasAtras: 10 });
    await achado(c, portal, { titulo: "IDOR em pedidos", severidade: "CRITICAL", status: "IN_PROGRESS", owasp: "A01", diasAtras: 9 });
    await achado(c, portal, { titulo: "XSS refletido", severidade: "HIGH", status: "OPEN", owasp: "A03", diasAtras: 8 });
    await achado(c, portal, { titulo: "Sessão sem expiração", severidade: "HIGH", status: "OPEN", owasp: "A07", diasAtras: 2 });
    await achado(c, portal, { titulo: "Cabeçalhos ausentes", severidade: "MEDIUM", status: "OPEN", owasp: "A05", diasAtras: 7 });
    // Sexta aberta, LOW: fica de fora porque o limite é 5 e ela é a menos grave.
    await achado(c, portal, { titulo: "Versão de banner", severidade: "LOW", status: "OPEN", owasp: "A05", diasAtras: 6 });

    const res = await request(app).get(ROTA).set(auth(c.token));
    expect(res.status).toBe(200);

    const principais = res.body.aplicacoes[0].principais;
    expect(principais.map((p: { title: string }) => p.title)).toEqual([
      "SQLi no login", // CRITICAL, 10 dias
      "IDOR em pedidos", // CRITICAL, 9 dias
      "XSS refletido", // HIGH, 8 dias
      "Sessão sem expiração", // HIGH, 2 dias
      "Cabeçalhos ausentes", // MEDIUM
    ]);
    expect(principais).toHaveLength(5);
    // Só os campos do contrato, sem data de criação.
    expect(Object.keys(principais[0]).sort()).toEqual(["id", "owaspCategory", "severityFinal", "status", "title"]);
    expect(principais[1].status).toBe("IN_PROGRESS");
  });

  it("EXG-04 — aplicações: pior severidade primeiro, empate pelo total de abertas", async () => {
    const c = await cenario();
    // Entrada em ordem arbitrária de propósito, para não depender da ordem de criação.
    const pequena = await aplicacao(c.company.id, { name: "Pequena", criticality: "LOW" });
    const legado = await aplicacao(c.company.id, { name: "Legado", criticality: "LOW" });
    const critica = await aplicacao(c.company.id, { name: "Crítica", criticality: "CRITICAL" });
    const grande = await aplicacao(c.company.id, { name: "Grande", criticality: "MEDIUM" });

    await achado(c, pequena, { titulo: "Média única", severidade: "MEDIUM", status: "OPEN", owasp: "A05", diasAtras: 3 });
    await achado(c, legado, { titulo: "Só corrigida", severidade: "HIGH", status: "FIXED", owasp: "A07", diasAtras: 40 });
    await achado(c, critica, { titulo: "Crítica", severidade: "CRITICAL", status: "OPEN", owasp: "A01", diasAtras: 3 });
    await achado(c, grande, { titulo: "Média 1", severidade: "MEDIUM", status: "OPEN", owasp: "A05", diasAtras: 3 });
    await achado(c, grande, { titulo: "Média 2", severidade: "MEDIUM", status: "OPEN", owasp: "A05", diasAtras: 2 });

    const res = await request(app).get(ROTA).set(auth(c.token));
    expect(res.status).toBe(200);

    // Crítica (CRITICAL) → Grande (MEDIUM, 2 abertas) → Pequena (MEDIUM, 1 aberta)
    // → Legado (sem abertas: piorSeveridade null, vai para o fim).
    expect(res.body.aplicacoes.map((a: { name: string }) => a.name)).toEqual(["Crítica", "Grande", "Pequena", "Legado"]);
    expect(res.body.aplicacoes[3].piorSeveridade).toBeNull();
    expect(res.body.aplicacoes[3].totalAbertas).toBe(0);
    expect(res.body.aplicacoes[3].totalResolvidas).toBe(1);
  });

  it("EXG-05 — aplicação desativada não aparece e seus achados não vazam", async () => {
    const c = await cenario();
    const portal = await aplicacao(c.company.id, { name: "Portal", criticality: "HIGH" });
    await achado(c, portal, { titulo: "Achado do portal", severidade: "HIGH", status: "OPEN", owasp: "A03", diasAtras: 3 });

    const desativada = await aplicacao(c.company.id, { name: "Sistema antigo", criticality: "CRITICAL", isActive: false });
    await achado(c, desativada, {
      titulo: "Vazamento no sistema antigo",
      severidade: "CRITICAL",
      status: "OPEN",
      owasp: "A02",
      diasAtras: 3,
    });

    const res = await request(app).get(ROTA).set(auth(c.token));
    expect(res.status).toBe(200);

    expect(res.body.aplicacoes.map((a: { name: string }) => a.name)).toEqual(["Portal"]);
    // Nem o id, nem o título do achado da desativada podem aparecer em lugar nenhum.
    const corpo = JSON.stringify(res.body);
    expect(corpo).not.toContain(desativada.application.id);
    expect(corpo).not.toContain("Vazamento no sistema antigo");
  });

  it("EXG-06 — company sem aplicações devolve lista vazia, não erro", async () => {
    const c = await cenario();

    const res = await request(app).get(ROTA).set(auth(c.token));

    expect(res.status).toBe(200);
    expect(res.body.companyId).toBe(c.company.id);
    expect(res.body.aplicacoes).toEqual([]);
  });

  /* ====================================================================
     Isolamento multi-tenant — canário TEN-18
     ==================================================================== */

  it("TEN-18 — a company B nunca vê nem vaza dados da company A, e vice-versa", async () => {
    const a = await cenario();
    const appA = await aplicacao(a.company.id, { name: "Portal da A", criticality: "HIGH" });
    await achado(a, appA, { titulo: "Achado da A", severidade: "HIGH", status: "OPEN", owasp: "A03", diasAtras: 3 });

    // Company B, com uma aplicação CRITICAL e um achado CRITICAL aberto.
    const planB = await seedPlan({ name: "PRO B" });
    const companyB = await seedCompany({ name: "Concorrente", planId: planB.id });
    const donoB = await seedUser({
      name: "Dono B",
      email: "donob@concorrente.com",
      password: SENHA,
      role: "CLIENT",
      companyId: companyB.id,
      companyRole: "OWNER",
    });
    const tokenB = await loginAs(app, donoB.email, SENHA);
    const appB = await aplicacao(companyB.id, { name: "Concorrente Secreta", criticality: "CRITICAL" });
    await achado(a, { application: { id: appB.application.id, companyId: companyB.id }, projetoId: appB.projetoId }, {
      titulo: "Credencial da concorrente",
      severidade: "CRITICAL",
      status: "OPEN",
      owasp: "A10",
      diasAtras: 2,
    });

    // A não enxerga nada da B: nem o id, nem o nome, nem o título, nem o id da company.
    const resA = await request(app).get(ROTA).set(auth(a.token));
    expect(resA.status).toBe(200);
    expect(resA.body.companyId).toBe(a.company.id);
    expect(resA.body.aplicacoes.map((x: { id: string }) => x.id)).toEqual([appA.application.id]);
    const corpoA = JSON.stringify(resA.body);
    expect(corpoA).not.toContain(companyB.id);
    expect(corpoA).not.toContain(appB.application.id);
    expect(corpoA).not.toContain("Concorrente Secreta");
    expect(corpoA).not.toContain("Credencial da concorrente");

    // Controle positivo: B enxerga a própria aplicação e só ela.
    const resB = await request(app).get(ROTA).set(auth(tokenB));
    expect(resB.status).toBe(200);
    expect(resB.body.companyId).toBe(companyB.id);
    expect(resB.body.aplicacoes.map((x: { id: string }) => x.id)).toEqual([appB.application.id]);
    expect(resB.body.aplicacoes[0].piorSeveridade).toBe("CRITICAL");
  });

  /* ====================================================================
     Autenticação e autorização
     ==================================================================== */

  it("AUT-01 — usuário sem company recebe 404 COMPANY_NOT_FOUND", async () => {
    const semCompany = await seedUser({ name: "Sem empresa", email: "semempresa@teste.com", password: SENHA, role: "CLIENT" });
    const token = await loginAs(app, semCompany.email, SENHA);

    const res = await request(app).get(ROTA).set(auth(token));

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("COMPANY_NOT_FOUND");
  });

  it("AUT-02 — sem token recebe 401", async () => {
    const res = await request(app).get(ROTA);
    expect(res.status).toBe(401);
  });
});
