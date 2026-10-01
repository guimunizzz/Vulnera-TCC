/**
 * remediation-assignee.test.ts (integration)
 *
 * Responsável pela remediação (CP-7) — atribuição, filtro e auditoria.
 *
 * DOIS TESTES AQUI VALEM MAIS QUE OS OUTROS:
 *
 *   ASSIGN-07  o filtro por responsável concorda nos DOIS construtores de
 *              query (`where()` do Prisma e `condicoesSql()` do SQL cru). São
 *              gêmeos que precisam ser mantidos à mão, e o jeito de garantir
 *              isso é comparar os conjuntos de resultados.
 *
 *   VULN-LIST-09  filtros COMPOSTOS combinam entre si. Foi escrito depois de
 *              encontrar um bug real: `where()` montava uma chave `AND` por
 *              filtro composto num mesmo objeto literal, e a última apagava
 *              as anteriores — SLA + aceite juntos perdia o SLA em silêncio,
 *              devolvendo MAIS findings do que o pedido.
 *
 *   ASSIGN-01  atribuir, reatribuir e desatribuir
 *   ASSIGN-02  PENTESTER só pode ser responsável se for membro do projeto
 *   ASSIGN-03  CLIENT só pode ser responsável na própria empresa
 *   ASSIGN-04  ADMIN pode ser responsável em qualquer finding
 *   ASSIGN-05  responsável inexistente é recusado
 *   ASSIGN-06  toda troca gera ASSIGNEE_CHANGED com de/para
 *   ASSIGN-07  filtro por responsável: os dois construtores concordam
 *   ASSIGN-08  `assignedTo=none` devolve os SEM responsável
 *   ASSIGN-09  CLIENT não atribui (não escreve no finding)
 *   VULN-LIST-09  canário: filtros compostos não se apagam
 */

import request from "supertest";
import { app } from "../../src/app";
import { cleanDatabase } from "../setup";
import { prisma } from "../../src/database/prisma.database";
import { seedUser } from "../fixtures/users.fixture";
import { seedPlan } from "../fixtures/plans.fixture";
import { seedCompany } from "../fixtures/companies.fixture";
import { seedSubscription } from "../fixtures/subscriptions.fixture";
import { seedApplication } from "../fixtures/applications.fixture";
import { seedProject, seedProjectMember } from "../fixtures/projects.fixture";
import { seedVulnerability } from "../fixtures/vulnerabilities.fixture";
import { loginAs } from "../fixtures/auth.fixture";

const PASSWORD = "senha12345";
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

type Cenario = {
  admin: string;
  adminId: string;
  clientA: string;
  clientAId: string;
  clientB: string;
  clientBId: string;
  pentester: string;
  pentesterId: string;
  pentesterFora: string;
  pentesterForaId: string;
  companyAId: string;
  appAId: string;
  projectAId: string;
};

async function montarCenario(): Promise<Cenario> {
  const plan = await seedPlan({ name: "PRO", maxApplications: 10 });
  const companyA = await seedCompany({ name: "Empresa A", planId: plan.id });
  const companyB = await seedCompany({ name: "Empresa B", planId: plan.id });
  for (const c of [companyA, companyB]) {
    await seedSubscription({ companyId: c.id, planId: plan.id, status: "ACTIVE", startDate: new Date() });
  }

  const admin = await seedUser({ name: "Admin", email: "admin@v.local", password: PASSWORD, role: "ADMIN" });
  const clientA = await seedUser({
    name: "Cliente A", email: "client-a@v.local", password: PASSWORD, role: "CLIENT",
    companyId: companyA.id, companyRole: "OWNER",
  });
  const clientB = await seedUser({
    name: "Cliente B", email: "client-b@v.local", password: PASSWORD, role: "CLIENT",
    companyId: companyB.id, companyRole: "OWNER",
  });
  const pentester = await seedUser({ name: "Pen", email: "pen@v.local", password: PASSWORD, role: "PENTESTER" });
  const pentesterFora = await seedUser({ name: "Pen Fora", email: "pen2@v.local", password: PASSWORD, role: "PENTESTER" });

  const appA = await seedApplication({ name: "App A", companyId: companyA.id, criticality: "HIGH", internetFacing: true });
  const projectA = await seedProject({ name: "Proj A", applicationId: appA.id, companyId: companyA.id });
  await seedProjectMember(projectA.id, pentester.id);

  await prisma.slaPolicy.create({
    data: { companyId: null, name: "Padrão", criticalDays: 2, highDays: 7, mediumDays: 30, lowDays: 90, createdBy: "system" },
  });

  return {
    admin: await loginAs(app, admin.email, PASSWORD),
    adminId: admin.id,
    clientA: await loginAs(app, clientA.email, PASSWORD),
    clientAId: clientA.id,
    clientB: await loginAs(app, clientB.email, PASSWORD),
    clientBId: clientB.id,
    pentester: await loginAs(app, pentester.email, PASSWORD),
    pentesterId: pentester.id,
    pentesterFora: await loginAs(app, pentesterFora.email, PASSWORD),
    pentesterForaId: pentesterFora.id,
    companyAId: companyA.id,
    appAId: appA.id,
    projectAId: projectA.id,
  };
}

async function criarFinding(c: Cenario, over: Record<string, unknown> = {}) {
  return seedVulnerability({
    projectId: c.projectAId,
    applicationId: c.appAId,
    companyId: c.companyAId,
    createdBy: c.pentesterId,
    ...over,
  } as Parameters<typeof seedVulnerability>[0]);
}

const atribuir = (token: string, id: string, assignedTo: string | null) =>
  request(app).post(`/api/vulnerabilities/${id}/assign`).set(auth(token)).send({ assignedTo });

describe("Responsável pela remediação (CP-7)", () => {
  let c: Cenario;

  beforeEach(async () => {
    await cleanDatabase();
    c = await montarCenario();
  });

  it("ASSIGN-01 atribui, reatribui e desatribui", async () => {
    const v = await criarFinding(c);

    const primeira = await atribuir(c.pentester, v.id, c.pentesterId);
    expect(primeira.status).toBe(200);
    expect(primeira.body.assignedTo).toBe(c.pentesterId);

    const segunda = await atribuir(c.pentester, v.id, c.clientAId);
    expect(segunda.status).toBe(200);
    expect(segunda.body.assignedTo).toBe(c.clientAId);

    const limpa = await atribuir(c.pentester, v.id, null);
    expect(limpa.status).toBe(200);
    expect(limpa.body.assignedTo).toBeNull();

    const persistido = await prisma.vulnerability.findUniqueOrThrow({ where: { id: v.id } });
    expect(persistido.assignedTo).toBeNull();
  });

  it("ASSIGN-02 PENTESTER só é responsável se for membro do projeto", async () => {
    const v = await criarFinding(c);

    // Membro: pode.
    expect((await atribuir(c.admin, v.id, c.pentesterId)).status).toBe(200);

    // Não-membro: recusado. Atribuir a quem não enxerga o finding criaria uma
    // tarefa fantasma — visível para quem atribuiu, invisível para o atribuído.
    const fora = await atribuir(c.admin, v.id, c.pentesterForaId);
    expect(fora.status).toBe(422);
    expect(fora.body.error).toBe("ASSIGNEE_NOT_ALLOWED");

    // E o responsável anterior continua lá — a recusa não zera nada.
    const persistido = await prisma.vulnerability.findUniqueOrThrow({ where: { id: v.id } });
    expect(persistido.assignedTo).toBe(c.pentesterId);
  });

  it("ASSIGN-10 lista no quadro somente responsáveis elegíveis, inclusive outro membro", async () => {
    const v = await criarFinding(c);
    await seedProjectMember(c.projectAId, c.pentesterForaId);

    const lista = await request(app)
      .get(`/api/vulnerabilities/${v.id}/assignees`)
      .set(auth(c.pentester));
    expect(lista.status).toBe(200);
    const ids = (lista.body as Array<{ id: string }>).map((u) => u.id);
    expect(ids).toEqual(expect.arrayContaining([c.pentesterId, c.pentesterForaId, c.adminId, c.clientAId]));
    // Cliente de outra empresa não passa pela mesma regra do endpoint POST.
    expect(ids).not.toContain(c.clientBId);
    for (const candidato of lista.body as Array<Record<string, unknown>>) {
      expect(Object.keys(candidato).sort()).toEqual(["id", "name"]);
      expect(candidato).not.toHaveProperty("email");
      expect(candidato).not.toHaveProperty("companyId");
    }
  });

  it("ASSIGN-12 endpoint reutilizável do filtro agrega membros dos projetos sem PII", async () => {
    await seedProjectMember(c.projectAId, c.pentesterForaId);

    const lista = await request(app)
      .get("/api/vulnerabilities/assignee-candidates")
      .set(auth(c.pentester));
    expect(lista.status).toBe(200);
    const ids = (lista.body as Array<{ id: string }>).map((u) => u.id);
    expect(ids).toEqual(expect.arrayContaining([c.pentesterId, c.pentesterForaId, c.adminId, c.clientAId]));
    expect(ids).not.toContain(c.clientBId);
    for (const candidato of lista.body as Array<Record<string, unknown>>) {
      expect(Object.keys(candidato).sort()).toEqual(["id", "name"]);
    }

    const porProjeto = await request(app)
      .get(`/api/vulnerabilities/assignee-candidates?projectId=${c.projectAId}`)
      .set(auth(c.pentester));
    expect(porProjeto.status).toBe(200);
    expect(porProjeto.body.map((u: { id: string }) => u.id)).toEqual(expect.arrayContaining(ids));
  });

  it("ASSIGN-11 POST e PUT mapeiam erros de responsável sem responder 500", async () => {
    const base = {
      projectId: c.projectAId,
      title: "Finding com responsável inválido",
      description: "Descrição suficiente para o teste de validação.",
      owaspCategory: "A03",
      cvssVector: "AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
    };

    const tipoInvalido = await request(app)
      .post("/api/vulnerabilities")
      .set(auth(c.pentester))
      .send({ ...base, assignedTo: 123 });
    expect(tipoInvalido.status).toBe(400);
    expect(tipoInvalido.body.error).toBe("INVALID_ASSIGNEE");

    const create = await request(app).post("/api/vulnerabilities").set(auth(c.pentester)).send(base);
    expect(create.status).toBe(201);

    const postNaoEncontrado = await atribuir(c.admin, create.body.id, "nao-existe");
    expect(postNaoEncontrado.status).toBe(404);
    expect(postNaoEncontrado.body.error).toBe("ASSIGNEE_NOT_FOUND");

    const putNaoPermitido = await request(app)
      .put(`/api/vulnerabilities/${create.body.id}`)
      .set(auth(c.admin))
      .send({ assignedTo: c.clientBId });
    expect(putNaoPermitido.status).toBe(422);
    expect(putNaoPermitido.body.error).toBe("ASSIGNEE_NOT_ALLOWED");
  });

  it("ASSIGN-03 CLIENT só é responsável na própria empresa", async () => {
    const v = await criarFinding(c);

    expect((await atribuir(c.admin, v.id, c.clientAId)).status).toBe(200);

    const deOutraEmpresa = await atribuir(c.admin, v.id, c.clientBId);
    expect(deOutraEmpresa.status).toBe(422);
    expect(deOutraEmpresa.body.error).toBe("ASSIGNEE_NOT_ALLOWED");
  });

  it("ASSIGN-04 ADMIN pode ser responsável em qualquer finding", async () => {
    const v = await criarFinding(c);
    const r = await atribuir(c.pentester, v.id, c.adminId);
    expect(r.status).toBe(200);
    expect(r.body.assignedTo).toBe(c.adminId);
  });

  it("ASSIGN-05 responsável inexistente é recusado", async () => {
    const v = await criarFinding(c);
    const r = await atribuir(c.admin, v.id, "nao-existe");
    expect(r.status).toBe(404);
    expect(r.body.error).toBe("ASSIGNEE_NOT_FOUND");
  });

  it("ASSIGN-06 toda troca gera ASSIGNEE_CHANGED com de/para", async () => {
    const v = await criarFinding(c);

    await atribuir(c.pentester, v.id, c.pentesterId);
    await atribuir(c.pentester, v.id, c.clientAId);
    await atribuir(c.pentester, v.id, null);
    // Atribuir para o MESMO responsável não gera evento — não houve troca.
    await atribuir(c.pentester, v.id, null);

    const eventos = await prisma.auditLog.findMany({
      where: { entityId: v.id, action: "ASSIGNEE_CHANGED" },
      orderBy: { createdAt: "asc" },
    });
    expect(eventos).toHaveLength(3);

    const diffs = eventos.map((e) => JSON.parse(e.diffJson ?? "{}"));
    expect(diffs[0]).toEqual({ from: null, to: c.pentesterId });
    expect(diffs[1]).toEqual({ from: c.pentesterId, to: c.clientAId });
    expect(diffs[2]).toEqual({ from: c.clientAId, to: null });
  });

  it("ASSIGN-07 o filtro por responsável concorda nos dois construtores", async () => {
    // A ordenação por severidade usa SQL cru (`condicoesSql`); as demais usam
    // o Prisma (`where`). São gêmeos escritos à mão — este teste é o que
    // detecta quando um recebe um filtro e o outro não.
    const meus = await Promise.all([
      criarFinding(c, { title: "Meu 1", severityCalculated: "HIGH" }),
      criarFinding(c, { title: "Meu 2", severityCalculated: "LOW" }),
    ]);
    await criarFinding(c, { title: "De outro", severityCalculated: "CRITICAL" });

    for (const v of meus) await atribuir(c.admin, v.id, c.pentesterId);

    const buscar = async (sortBy: string): Promise<string[]> => {
      const res = await request(app)
        .get(`/api/vulnerabilities?assignedTo=${c.pentesterId}&sortBy=${sortBy}&sortOrder=desc`)
        .set(auth(c.admin));
      expect(res.status).toBe(200);
      return (res.body.data as Array<{ title: string }>).map((v) => v.title).sort();
    };

    const porSeveridade = await buscar("severity"); // caminho SQL cru
    const porData = await buscar("createdAt"); // caminho Prisma
    expect(porSeveridade).toEqual(["Meu 1", "Meu 2"]);
    expect(porSeveridade).toEqual(porData);
  });

  it("ASSIGN-08 assignedTo=none devolve os sem responsável", async () => {
    const atribuido = await criarFinding(c, { title: "Com dono" });
    await criarFinding(c, { title: "Sem dono 1" });
    await criarFinding(c, { title: "Sem dono 2" });
    await atribuir(c.admin, atribuido.id, c.pentesterId);

    const semDono = async (sortBy: string): Promise<string[]> => {
      const res = await request(app)
        .get(`/api/vulnerabilities?assignedTo=none&sortBy=${sortBy}`)
        .set(auth(c.admin));
      expect(res.status).toBe(200);
      return (res.body.data as Array<{ title: string }>).map((v) => v.title).sort();
    };

    // `IN (...)` nunca casa com NULL: "sem responsável" precisa virar IS NULL
    // nos dois construtores, e este teste cobra os dois.
    expect(await semDono("createdAt")).toEqual(["Sem dono 1", "Sem dono 2"]);
    expect(await semDono("severity")).toEqual(["Sem dono 1", "Sem dono 2"]);

    // E "meus OU sem dono" numa tacada só — é o filtro do Kanban pessoal.
    const combinado = await request(app)
      .get(`/api/vulnerabilities?assignedTo=${c.pentesterId},none`)
      .set(auth(c.admin));
    expect((combinado.body.data as unknown[]).length).toBe(3);
  });

  it("ASSIGN-09 CLIENT não atribui responsável", async () => {
    const v = await criarFinding(c);
    // CLIENT não escreve no finding (regra antiga do produto); atribuir é escrever.
    const r = await atribuir(c.clientA, v.id, c.clientAId);
    expect(r.status).toBe(403);
  });

  it("VULN-LIST-09 canário: filtros compostos não se apagam entre si", async () => {
    // 🎯 Escrito depois de um bug real: cada filtro composto (SLA, aceite,
    // responsável) montava sua própria chave `AND` num mesmo objeto literal, e
    // a última sobrescrevia as anteriores. O sintoma era mudo — a busca
    // devolvia MAIS findings do que o pedido, nunca menos.
    const comTudo = await criarFinding(c, { title: "Bate em tudo", severityCalculated: "CRITICAL" });
    const soResponsavel = await criarFinding(c, { title: "Só responsável", severityCalculated: "LOW" });

    await atribuir(c.admin, comTudo.id, c.pentesterId);
    await atribuir(c.admin, soResponsavel.id, c.pentesterId);

    // O primeiro ganha SLA estourado; o segundo fica no prazo.
    await prisma.vulnerability.update({
      where: { id: comTudo.id },
      data: {
        slaStartedAt: new Date(Date.now() - 30 * 24 * 3600 * 1000),
        slaDueAt: new Date(Date.now() - 24 * 3600 * 1000),
        slaDueSoonAt: new Date(Date.now() - 2 * 24 * 3600 * 1000),
      },
    });
    await prisma.vulnerability.update({
      where: { id: soResponsavel.id },
      data: {
        slaStartedAt: new Date(),
        slaDueAt: new Date(Date.now() + 30 * 24 * 3600 * 1000),
        slaDueSoonAt: new Date(Date.now() + 25 * 24 * 3600 * 1000),
      },
    });

    // Três filtros compostos ao mesmo tempo: responsável + SLA + aceite.
    const res = await request(app)
      .get(`/api/vulnerabilities?assignedTo=${c.pentesterId}&slaState=BREACHED&riskAcceptance=NONE`)
      .set(auth(c.admin));
    expect(res.status).toBe(200);

    const titulos = (res.body.data as Array<{ title: string }>).map((v) => v.title);
    // Se um filtro tivesse apagado o outro, "Só responsável" entraria aqui.
    expect(titulos).toEqual(["Bate em tudo"]);

    // E o caminho SQL cru (ordenação por severidade) concorda.
    const porSeveridade = await request(app)
      .get(`/api/vulnerabilities?assignedTo=${c.pentesterId}&slaState=BREACHED&riskAcceptance=NONE&sortBy=severity`)
      .set(auth(c.admin));
    expect((porSeveridade.body.data as Array<{ title: string }>).map((v) => v.title)).toEqual(titulos);
  });
});
