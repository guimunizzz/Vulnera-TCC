/**
 * triage-inbox.test.ts — GET /api/triage/inbox (ADR-062).
 *
 *   TIB-01  PENTESTER: NEW do DAST dos scans DELE e do SAST/SCA dos projetos de
 *           que é membro, só a última importação; triado fica de fora
 *   TIB-02  scan de outro PENTESTER e projeto sem vínculo não aparecem
 *   TIB-03  CLIENT OWNER: só o Threat Intel da própria empresa (pode triar);
 *           CLIENT MEMBER não vê nada (não pode triar); empresa B não aparece
 *   TIB-04  sem token → 401
 *
 * RATE LIMIT: bucket `expensive` (burst 3 por usuário) — uma chamada por usuário.
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
import { loginAs } from "../fixtures/auth.fixture";

const SENHA = "senha12345";
const ROTA = "/api/triage/inbox";
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const DIA_MS = 86_400_000;
const diasAtras = (n: number) => new Date(Date.now() - n * DIA_MS);

let seq = 0;
async function pessoa(dados: { role: "CLIENT" | "PENTESTER" | "ADMIN"; companyId?: string; companyRole?: string }) {
  seq += 1;
  const email = `p${seq}@teste.com`;
  const user = await seedUser({ name: `Pessoa ${seq}`, email, password: SENHA, ...dados });
  return { user, email };
}

async function empresa(nome: string) {
  seq += 1;
  const plan = await seedPlan({ name: `PRO-${seq}` });
  return seedCompany({ name: nome, planId: plan.id });
}

async function projeto(companyId: string, nome: string) {
  const application = await seedApplication({ name: nome, companyId });
  return seedProject({ name: `Projeto ${nome}`, applicationId: application.id, companyId });
}

async function importacao(p: { id: string; companyId: string }, uploadedById: string, toolName: string, criadaEm: Date) {
  return prisma.codeScanImport.create({ data: { projectId: p.id, companyId: p.companyId, format: "SARIF", toolName, fileName: "r.sarif", uploadedById, createdAt: criadaEm } });
}

async function achadoDeCodigo(imp: { id: string; projectId: string; companyId: string }, titulo: string, triageStatus: "NEW" | "CONFIRMED" = "NEW") {
  seq += 1;
  return prisma.codeFinding.create({
    data: { importId: imp.id, projectId: imp.projectId, companyId: imp.companyId, fingerprint: `fp-${seq}`, category: "SAST", ruleId: `regra-${seq}`, title: titulo, severity: "HIGH", filePath: "src/app.js", startLine: 42, triageStatus },
  });
}

describe("Caixa de triagem (ADR-062)", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it("TIB-01/02 — PENTESTER vê os NEW das fontes técnicas que ele acessa", async () => {
    const a = await empresa("TechNova");
    const bruno = await pessoa({ role: "PENTESTER" });
    const outro = await pessoa({ role: "PENTESTER" });

    // DAST: scan do Bruno com um NEW e um triado; scan de outro pentester.
    const scan = await prisma.dastScan.create({ data: { targetUrl: "https://loja.exemplo.test", requestedById: bruno.user.id, status: "COMPLETED" } });
    const doOutro = await prisma.dastScan.create({ data: { targetUrl: "https://outro.exemplo.test", requestedById: outro.user.id, status: "COMPLETED" } });
    const dast = (scanId: string, title: string, triageStatus: "NEW" | "FALSE_POSITIVE" = "NEW") =>
      prisma.dastFinding.create({
        data: { scanId, fingerprint: `fp-dast-${++seq}`, pluginId: "40018", title, risk: "HIGH", confidence: "Medium", url: "https://loja.exemplo.test/login?next=/", normalizedUrl: "https://loja.exemplo.test/login", param: "user", triageStatus },
      });
    const sqli = await dast(scan.id, "SQL Injection");
    await dast(scan.id, "Já triado", "FALSE_POSITIVE");
    await dast(doOutro.id, "Do outro pentester");

    // SAST: projeto em que o Bruno é membro (importação velha e nova) e um sem vínculo.
    const comVinculo = await projeto(a.id, "Portal");
    await prisma.projectMember.create({ data: { projectId: comVinculo.id, userId: bruno.user.id } });
    const velha = await importacao(comVinculo, bruno.user.id, "semgrep", diasAtras(5));
    await achadoDeCodigo(velha, "Achado da importação velha");
    const nova = await importacao(comVinculo, bruno.user.id, "semgrep", diasAtras(1));
    const evalAchado = await achadoDeCodigo(nova, "eval com entrada do usuário");
    await achadoDeCodigo(nova, "Já confirmado", "CONFIRMED");
    const semVinculo = await projeto(a.id, "Interno");
    await achadoDeCodigo(await importacao(semVinculo, outro.user.id, "semgrep", diasAtras(1)), "Projeto sem vínculo");

    const token = await loginAs(app, bruno.email, SENHA);
    const res = await request(app).get(ROTA).set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.porFonte).toEqual({ DAST: 1, CODIGO: 1, THREAT_INTEL: 0 });
    const porId = new Map(res.body.itens.map((i: { id: string }) => [i.id, i]));
    expect(porId.get(sqli.id)).toMatchObject({ fonte: "DAST", contexto: "loja.exemplo.test · /login?next=/ · parâmetro user", link: `/dast/scans/${scan.id}` });
    expect(porId.get(evalAchado.id)).toMatchObject({ fonte: "CODIGO", contexto: "Portal · semgrep · src/app.js:42", link: `/sast-sca/imports/${nova.id}` });
  });

  it("TIB-03 — CLIENT OWNER vê o Threat Intel da própria empresa; MEMBER não", async () => {
    const a = await empresa("TechNova");
    const b = await empresa("Concorrente");
    const dona = await pessoa({ role: "CLIENT", companyId: a.id, companyRole: "OWNER" });
    const membro = await pessoa({ role: "CLIENT", companyId: a.id, companyRole: "MEMBER" });

    await prisma.threatAdvisory.create({ data: { id: "CVE-2024-1111", source: "NVD", title: "RCE no express", severity: "CRITICAL", kev: true } });
    const casar = async (companyId: string, triageStatus: "NEW" | "CONFIRMED" = "NEW") => {
      seq += 1;
      const asset = await prisma.techAsset.create({ data: { companyId, kind: "PACKAGE", ecosystem: "npm", packageName: "express", version: "4.0.0", displayName: "express", source: "MANUAL", identityKey: `npm:express:${seq}` } });
      return prisma.threatMatch.create({ data: { companyId, assetId: asset.id, advisoryId: "CVE-2024-1111", triageStatus } });
    };
    const daA = await casar(a.id);
    await casar(a.id, "CONFIRMED");
    await casar(b.id);

    const tokenDona = await loginAs(app, dona.email, SENHA);
    const daDona = await request(app).get(ROTA).set(auth(tokenDona));
    expect(daDona.status).toBe(200);
    expect(daDona.body.porFonte).toEqual({ DAST: 0, CODIGO: 0, THREAT_INTEL: 1 });
    expect(daDona.body.itens[0]).toMatchObject({ fonte: "THREAT_INTEL", id: daA.id, severidade: "CRITICAL", companyId: a.id });
    expect(daDona.body.itens[0].contexto).toContain("KEV");

    const tokenMembro = await loginAs(app, membro.email, SENHA);
    const doMembro = await request(app).get(ROTA).set(auth(tokenMembro));
    expect(doMembro.body.total).toBe(0);
  });

  it("TIB-04 — sem token → 401", async () => {
    expect((await request(app).get(ROTA)).status).toBe(401);
  });
});
