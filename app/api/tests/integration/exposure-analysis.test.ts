/**
 * exposure-analysis.test.ts
 *
 * Análises do Exposure Graph (ADR-061):
 *   GET /api/companies/me/exposure-graph/toxic-combinations
 *   GET /api/companies/me/exposure-graph/blast-radius/options
 *   GET /api/companies/me/exposure-graph/blast-radius?tipo=&valor=
 *   GET /api/companies/me/exposure-graph/history
 *
 *   EXA-01  combinação tóxica: Internet + crítica + KEV (via SCA) + dado + produção;
 *           interna, média e fechada ficam de fora
 *   EXA-02  raio de impacto de pacote: só a última importação de cada
 *           ferramenta, sem falso positivo; opções contam aplicações
 *   EXA-03  raio de impacto de categoria; entradas inválidas → 400
 *   EXA-04  histórico: criação + STATUS_CHANGE em ordem; diff malformado ignorado
 *
 *   TEN-EXA  isolamento: nada da company B aparece para a A (combinação,
 *            impacto, histórico)
 *   AUT-EXA  sem company → 404; sem token → 401
 *
 * RATE LIMIT
 * Bucket `expensive`: burst de 3 por usuário. Cada usuário faz no máximo 3 chamadas.
 */

import request from "supertest";
import { app } from "../../src/app";
import { prisma } from "../../src/database/prisma.database";
import { cleanDatabase } from "../setup";
import { seedUser } from "../fixtures/users.fixture";
import { seedPlan } from "../fixtures/plans.fixture";
import { seedCompany } from "../fixtures/companies.fixture";
import { seedApplication } from "../fixtures/applications.fixture";
import { seedProject } from "../fixtures/projects.fixture";
import { seedVulnerability } from "../fixtures/vulnerabilities.fixture";
import { loginAs } from "../fixtures/auth.fixture";

const SENHA = "senha12345";
const BASE = "/api/companies/me/exposure-graph";
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const DIA_MS = 86_400_000;
const diasAtras = (n: number) => new Date(Date.now() - n * DIA_MS);

let seq = 0;

async function empresa(nome: string) {
  seq += 1;
  const plan = await seedPlan({ name: `PRO-${seq}` });
  const company = await seedCompany({ name: nome, planId: plan.id });
  const email = `dona${seq}@teste.com`;
  const owner = await seedUser({ name: `Dona ${seq}`, email, password: SENHA, role: "CLIENT", companyId: company.id, companyRole: "OWNER" });
  return { company, owner, email };
}

async function aplicacao(companyId: string, dados: { name: string; internetFacing: boolean; environment: string; dataSensitivity: string }) {
  const application = await seedApplication({ ...dados, criticality: "HIGH", companyId });
  const projeto = await seedProject({ name: `Projeto ${dados.name}`, applicationId: application.id, companyId });
  return { application, projetoId: projeto.id };
}

async function importacaoSca(alvo: { projetoId: string; application: { companyId: string } }, uploadedById: string, toolName: string, criadaEm: Date) {
  return prisma.codeScanImport.create({
    data: { projectId: alvo.projetoId, companyId: alvo.application.companyId, format: "CYCLONEDX", toolName, fileName: "sbom.json", uploadedById, createdAt: criadaEm },
  });
}

async function achadoSca(
  imp: { id: string; projectId: string; companyId: string },
  dados: { pacote: string; versao: string; cve?: string; severidade?: string; triage?: "NEW" | "FALSE_POSITIVE" },
) {
  seq += 1;
  return prisma.codeFinding.create({
    data: {
      importId: imp.id,
      projectId: imp.projectId,
      companyId: imp.companyId,
      fingerprint: `fp-${seq}`,
      category: "SCA",
      ruleId: dados.cve ?? `regra-${seq}`,
      title: `${dados.pacote} vulnerável`,
      severity: dados.severidade ?? "HIGH",
      packageName: dados.pacote,
      packageVersion: dados.versao,
      advisoryId: dados.cve ?? null,
      triageStatus: dados.triage ?? "NEW",
    },
  });
}

describe("Análises do Exposure Graph (ADR-061)", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it("EXA-01 — combinação tóxica com KEV alcançado pela origem SCA", async () => {
    const a = await empresa("TechNova");
    const analista = await seedUser({ name: "Analista", email: "analista@teste.com", password: SENHA, role: "PENTESTER" });
    const portal = await aplicacao(a.company.id, { name: "Portal", internetFacing: true, environment: "PROD", dataSensitivity: "RESTRICTED" });
    const erp = await aplicacao(a.company.id, { name: "ERP", internetFacing: false, environment: "PROD", dataSensitivity: "RESTRICTED" });

    await prisma.threatAdvisory.create({ data: { id: "CVE-2021-44228", source: "KEV", kev: true, kevAddedAt: new Date("2021-12-10T00:00:00Z"), epssPercentile: 0.99 } });
    const imp = await importacaoSca(portal, analista.id, "trivy", diasAtras(2));
    const achado = await achadoSca(imp, { pacote: "log4j-core", versao: "2.14.1", cve: "cve-2021-44228", severidade: "CRITICAL" });

    const base = { projectId: portal.projetoId, applicationId: portal.application.id, companyId: a.company.id, createdBy: analista.id };
    const log4j = await seedVulnerability({ ...base, title: "Log4Shell", severityCalculated: "CRITICAL", owaspCategory: "A06", sourceType: "SCA_IMPORT" });
    await prisma.vulnerability.update({ where: { id: log4j.id }, data: { sourceCodeFindingId: achado.id } });
    const manual = await seedVulnerability({ ...base, title: "IDOR em pedidos", severityCalculated: "HIGH", owaspCategory: "A01" });
    // Fora: média, fechada e na aplicação interna.
    await seedVulnerability({ ...base, title: "Banner", severityCalculated: "MEDIUM", owaspCategory: "A05" });
    await seedVulnerability({ ...base, title: "Já corrigida", severityCalculated: "CRITICAL", status: "FIXED" });
    await seedVulnerability({ projectId: erp.projetoId, applicationId: erp.application.id, companyId: a.company.id, createdBy: analista.id, title: "Interna", severityCalculated: "CRITICAL" });

    const token = await loginAs(app, a.email, SENHA);
    const res = await request(app).get(`${BASE}/toxic-combinations`).set(auth(token));

    expect(res.status).toBe(200);
    expect(res.body.criterio).toEqual({ minimoDeAgravantes: 3, limiarEpssPercentil: 0.9 });
    expect(res.body.total).toBe(2);
    const [primeira, segunda] = res.body.combinacoes;
    // Log4Shell: 5 agravantes (com KEV) antes do IDOR (4, sem ameaça).
    expect(primeira.vulnerabilityId).toBe(log4j.id);
    expect(primeira.advisory).toEqual({ id: "CVE-2021-44228", kev: true, epssPercentile: 0.99 });
    expect(primeira.agravantes.map((g: { codigo: string }) => g.codigo)).toEqual(["INTERNET", "GRAVE", "AMEACA_ATIVA", "DADO_SENSIVEL", "PRODUCAO"]);
    expect(segunda.vulnerabilityId).toBe(manual.id);
    expect(segunda.advisory).toBeNull();
  });

  it("EXA-02 — raio de impacto de pacote usa a última importação, sem falso positivo", async () => {
    const a = await empresa("TechNova");
    const b = await empresa("Concorrente");
    const analista = await seedUser({ name: "Analista", email: "analista@teste.com", password: SENHA, role: "PENTESTER" });
    const portal = await aplicacao(a.company.id, { name: "Portal", internetFacing: true, environment: "PROD", dataSensitivity: "INTERNAL" });
    const api = await aplicacao(a.company.id, { name: "API", internetFacing: false, environment: "HOMOL", dataSensitivity: "INTERNAL" });
    const legado = await aplicacao(a.company.id, { name: "Legado", internetFacing: true, environment: "PROD", dataSensitivity: "INTERNAL" });
    const deB = await aplicacao(b.company.id, { name: "De B", internetFacing: true, environment: "PROD", dataSensitivity: "INTERNAL" });

    // Portal: a importação antiga tinha 4.17.11; a atual tem 4.17.15 — só a atual conta.
    const antiga = await importacaoSca(portal, analista.id, "trivy", diasAtras(10));
    await achadoSca(antiga, { pacote: "lodash", versao: "4.17.11" });
    const atual = await importacaoSca(portal, analista.id, "trivy", diasAtras(1));
    await achadoSca(atual, { pacote: "lodash", versao: "4.17.15", severidade: "CRITICAL" });
    // API: lodash atual, mas triado como falso positivo; e um pacote que conta.
    const daApi = await importacaoSca(api, analista.id, "grype", diasAtras(1));
    await achadoSca(daApi, { pacote: "lodash", versao: "4.17.20", triage: "FALSE_POSITIVE" });
    await achadoSca(daApi, { pacote: "minimist", versao: "1.2.0" });
    // Legado: tinha lodash, a importação mais nova da mesma ferramenta não tem mais.
    const legadoAntiga = await importacaoSca(legado, analista.id, "trivy", diasAtras(5));
    await achadoSca(legadoAntiga, { pacote: "lodash", versao: "3.0.0" });
    const legadoAtual = await importacaoSca(legado, analista.id, "trivy", diasAtras(1));
    await achadoSca(legadoAtual, { pacote: "express", versao: "4.0.0" });
    // Company B também tem lodash — nunca aparece para A.
    const daB = await importacaoSca(deB, analista.id, "trivy", diasAtras(1));
    await achadoSca(daB, { pacote: "lodash", versao: "4.17.15" });

    const token = await loginAs(app, a.email, SENHA);
    const impacto = await request(app).get(`${BASE}/blast-radius`).query({ tipo: "PACOTE", valor: "lodash" }).set(auth(token));
    expect(impacto.status).toBe(200);
    expect(impacto.body.aplicacoes.map((x: { name: string }) => x.name)).toEqual(["Portal"]);
    expect(impacto.body.aplicacoes[0]).toMatchObject({ ocorrencias: 1, piorSeveridade: "CRITICAL", detalhes: ["4.17.15"] });
    expect(impacto.body.resumo).toEqual({ aplicacoes: 1, expostas: 1, emProducao: 1, ocorrencias: 1 });

    const opcoes = await request(app).get(`${BASE}/blast-radius/options`).set(auth(token));
    expect(opcoes.status).toBe(200);
    const pacotes = opcoes.body.filter((o: { tipo: string }) => o.tipo === "PACOTE").map((o: { valor: string; aplicacoes: number }) => `${o.valor}:${o.aplicacoes}`);
    expect(pacotes.sort()).toEqual(["express:1", "lodash:1", "minimist:1"]);
  });

  it("EXA-03 — raio de impacto de categoria e entradas inválidas", async () => {
    const a = await empresa("TechNova");
    const analista = await seedUser({ name: "Analista", email: "analista@teste.com", password: SENHA, role: "PENTESTER" });
    const portal = await aplicacao(a.company.id, { name: "Portal", internetFacing: true, environment: "PROD", dataSensitivity: "INTERNAL" });
    const api = await aplicacao(a.company.id, { name: "API", internetFacing: false, environment: "DEV", dataSensitivity: "INTERNAL" });
    const doPortal = { projectId: portal.projetoId, applicationId: portal.application.id, companyId: a.company.id, createdBy: analista.id };
    await seedVulnerability({ ...doPortal, owaspCategory: "A03", severityCalculated: "HIGH" });
    await seedVulnerability({ ...doPortal, owaspCategory: "A03", severityCalculated: "LOW" });
    await seedVulnerability({ ...doPortal, owaspCategory: "A03", severityCalculated: "CRITICAL", status: "CLOSED" });
    await seedVulnerability({ projectId: api.projetoId, applicationId: api.application.id, companyId: a.company.id, createdBy: analista.id, owaspCategory: "A03", severityCalculated: "MEDIUM" });

    const token = await loginAs(app, a.email, SENHA);
    const res = await request(app).get(`${BASE}/blast-radius`).query({ tipo: "CATEGORIA", valor: "a03" }).set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.valor).toBe("A03");
    expect(res.body.aplicacoes.map((x: { name: string; ocorrencias: number }) => `${x.name}:${x.ocorrencias}`)).toEqual(["Portal:2", "API:1"]);

    const tipoRuim = await request(app).get(`${BASE}/blast-radius`).query({ tipo: "HOST", valor: "x" }).set(auth(token));
    expect(tipoRuim.status).toBe(400);
    expect(tipoRuim.body.error).toBe("INVALID_IMPACT_TYPE");
    const categoriaRuim = await request(app).get(`${BASE}/blast-radius`).query({ tipo: "CATEGORIA", valor: "A11" }).set(auth(token));
    expect(categoriaRuim.status).toBe(400);
    expect(categoriaRuim.body.error).toBe("INVALID_IMPACT_VALUE");
  });

  it("EXA-04 — histórico traz criação e mudanças de status em ordem", async () => {
    const a = await empresa("TechNova");
    const analista = await seedUser({ name: "Analista", email: "analista@teste.com", password: SENHA, role: "PENTESTER" });
    const portal = await aplicacao(a.company.id, { name: "Portal", internetFacing: true, environment: "PROD", dataSensitivity: "INTERNAL" });
    const base = { projectId: portal.projetoId, applicationId: portal.application.id, companyId: a.company.id, createdBy: analista.id };
    const corrigida = await seedVulnerability({ ...base, title: "Corrigida", status: "FIXED", createdAt: diasAtras(10) });
    const aberta = await seedVulnerability({ ...base, title: "Aberta", createdAt: diasAtras(4) });
    const log = (entityId: string, diffJson: string, em: Date) =>
      prisma.auditLog.create({ data: { actorId: analista.id, companyId: a.company.id, entityType: "Vulnerability", entityId, action: "STATUS_CHANGE", diffJson, createdAt: em } });
    await log(corrigida.id, '{"from":"IN_PROGRESS","to":"FIXED"}', diasAtras(3));
    await log(corrigida.id, '{"from":"OPEN","to":"IN_PROGRESS"}', diasAtras(6));
    await log(corrigida.id, "texto que não é json", diasAtras(2));

    const token = await loginAs(app, a.email, SENHA);
    const res = await request(app).get(`${BASE}/history`).set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.inicio).toBe(corrigida.createdAt.toISOString());
    const [primeira, segunda] = res.body.vulnerabilidades;
    expect(primeira.id).toBe(corrigida.id);
    expect(primeira.mudancas.map((m: { para: string }) => m.para)).toEqual(["IN_PROGRESS", "FIXED"]);
    expect(segunda).toMatchObject({ id: aberta.id, status: "OPEN", mudancas: [] });
  });

  it("TEN-EXA — nada da company B aparece para a A", async () => {
    const a = await empresa("TechNova");
    const b = await empresa("Concorrente");
    const analista = await seedUser({ name: "Analista", email: "analista@teste.com", password: SENHA, role: "PENTESTER" });
    await aplicacao(a.company.id, { name: "Portal A", internetFacing: true, environment: "PROD", dataSensitivity: "RESTRICTED" });
    const deB = await aplicacao(b.company.id, { name: "Portal B", internetFacing: true, environment: "PROD", dataSensitivity: "RESTRICTED" });
    const vulnB = await seedVulnerability({ projectId: deB.projetoId, applicationId: deB.application.id, companyId: b.company.id, createdBy: analista.id, owaspCategory: "A03" });
    await prisma.auditLog.create({ data: { actorId: analista.id, companyId: b.company.id, entityType: "Vulnerability", entityId: vulnB.id, action: "STATUS_CHANGE", diffJson: '{"to":"FIXED"}' } });

    const token = await loginAs(app, a.email, SENHA);
    const [toxicas, impacto, historico] = await Promise.all([
      request(app).get(`${BASE}/toxic-combinations`).set(auth(token)),
      request(app).get(`${BASE}/blast-radius`).query({ tipo: "CATEGORIA", valor: "A03" }).set(auth(token)),
      request(app).get(`${BASE}/history`).set(auth(token)),
    ]);
    expect(toxicas.body).toMatchObject({ companyId: a.company.id, total: 0, combinacoes: [] });
    expect(impacto.body.aplicacoes).toEqual([]);
    expect(historico.body.vulnerabilidades).toEqual([]);
  });

  it("AUT-EXA — sem company → 404; sem token → 401", async () => {
    await seedUser({ name: "Sem empresa", email: "solto@teste.com", password: SENHA, role: "PENTESTER" });
    const token = await loginAs(app, "solto@teste.com", SENHA);
    const res = await request(app).get(`${BASE}/toxic-combinations`).set(auth(token));
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("COMPANY_NOT_FOUND");
    expect((await request(app).get(`${BASE}/history`)).status).toBe(401);
  });
});
