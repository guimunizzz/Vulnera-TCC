/**
 * risk-acceptance.test.ts (integration)
 *
 * Aceite formal de risco (CP-4 — docs/DECISIONS.md D10) contra o banco e a
 * API reais. O que se prova aqui é, acima de tudo, QUEM PODE O QUÊ: esta é a
 * primeira feature do produto em que um CLIENT escreve no domínio de findings
 * e em que existe alçada de aprovação fora do módulo comercial.
 *
 *   RISK-ACC-01  ciclo feliz: solicitar → aprovar; vulnerability continua aberta
 *   RISK-ACC-02  rejeitar encerra o pedido e libera um novo
 *   RISK-ACC-03  revogar encerra o aceite vigente
 *   RISK-ACC-04  segundo pedido com um ativo → 409
 *   RISK-ACC-05  solicitante NÃO aprova o próprio pedido → 403 (inclusive ADMIN)
 *   RISK-ACC-06  CLIENT MEMBER não solicita nem aprova → 403
 *   RISK-ACC-07  PENTESTER membro solicita, mas NUNCA aprova → 403
 *   RISK-ACC-08  PENTESTER não-membro não solicita → 403
 *   RISK-ACC-09  registro decidido é imutável (não há rota de edição)
 *   RISK-ACC-10  expiração preguiçosa: normaliza, audita UMA vez e libera novo pedido
 *   RISK-ACC-11  SLA vira ACCEPTED enquanto vigente; VRS não muda
 *   RISK-ACC-12  fim da pausa devolve o tempo: dueAt/dueSoonAt deslocados, pausedMs somado
 *   RISK-ACC-13  validação: prazo no passado, acima do teto, acima do pedido, textos curtos
 *   RISK-ACC-14  busca: ?riskAcceptance= filtra e os DOIS construtores concordam
 *   TEN-32       CLIENT OWNER de B não lê, não pede e não decide aceite de A
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
import { DIA_MS } from "../../src/utils/sla.util";

const PASSWORD = "senha12345";
const RAZAO = "Compensado por WAF e monitoração ativa no perímetro.";
const JUSTIFICATIVA = "A correção exige reescrever o módulo de pagamento, previsto para o próximo trimestre.";

type Cenario = {
  admin: string;
  admin2: string;
  ownerA: string;
  ownerA2: string;
  memberA: string;
  ownerB: string;
  pentester: string;
  pentesterForaId: string;
  pentesterFora: string;
  adminId: string;
  ownerAId: string;
  companyAId: string;
  appAId: string;
  projectAId: string;
  projectBId: string;
  appBId: string;
  companyBId: string;
  pentesterId: string;
};

async function montarCenario(): Promise<Cenario> {
  const plan = await seedPlan({ name: "PRO", maxApplications: 10 });
  const companyA = await seedCompany({ name: "Empresa A", planId: plan.id });
  const companyB = await seedCompany({ name: "Empresa B", planId: plan.id });
  for (const c of [companyA, companyB]) {
    await seedSubscription({ companyId: c.id, planId: plan.id, status: "ACTIVE", startDate: new Date() });
  }
  const admin = await seedUser({ name: "Admin", email: "admin@v.local", password: PASSWORD, role: "ADMIN" });
  const admin2 = await seedUser({ name: "Admin 2", email: "admin2@v.local", password: PASSWORD, role: "ADMIN" });
  const ownerA = await seedUser({
    name: "Owner A", email: "owner-a@v.local", password: PASSWORD, role: "CLIENT",
    companyId: companyA.id, companyRole: "OWNER",
  });
  const ownerA2 = await seedUser({
    name: "Owner A2", email: "owner-a2@v.local", password: PASSWORD, role: "CLIENT",
    companyId: companyA.id, companyRole: "OWNER",
  });
  const memberA = await seedUser({
    name: "Member A", email: "member-a@v.local", password: PASSWORD, role: "CLIENT",
    companyId: companyA.id, companyRole: "MEMBER",
  });
  const ownerB = await seedUser({
    name: "Owner B", email: "owner-b@v.local", password: PASSWORD, role: "CLIENT",
    companyId: companyB.id, companyRole: "OWNER",
  });
  const pentester = await seedUser({ name: "Pen", email: "pen@v.local", password: PASSWORD, role: "PENTESTER" });
  const pentesterFora = await seedUser({ name: "Pen Fora", email: "pen2@v.local", password: PASSWORD, role: "PENTESTER" });

  const appA = await seedApplication({ name: "App A", companyId: companyA.id, criticality: "HIGH", internetFacing: true });
  const appB = await seedApplication({ name: "App B", companyId: companyB.id });
  const projectA = await seedProject({ name: "Proj A", applicationId: appA.id, companyId: companyA.id });
  const projectB = await seedProject({ name: "Proj B", applicationId: appB.id, companyId: companyB.id });
  await seedProjectMember(projectA.id, pentester.id);

  await prisma.slaPolicy.create({
    data: { companyId: null, name: "Padrão", criticalDays: 2, highDays: 7, mediumDays: 30, lowDays: 90, createdBy: "system" },
  });

  return {
    admin: await loginAs(app, admin.email, PASSWORD),
    admin2: await loginAs(app, admin2.email, PASSWORD),
    ownerA: await loginAs(app, ownerA.email, PASSWORD),
    ownerA2: await loginAs(app, ownerA2.email, PASSWORD),
    memberA: await loginAs(app, memberA.email, PASSWORD),
    ownerB: await loginAs(app, ownerB.email, PASSWORD),
    pentester: await loginAs(app, pentester.email, PASSWORD),
    pentesterFora: await loginAs(app, pentesterFora.email, PASSWORD),
    pentesterForaId: pentesterFora.id,
    adminId: admin.id,
    ownerAId: ownerA.id,
    companyAId: companyA.id,
    companyBId: companyB.id,
    appAId: appA.id,
    appBId: appB.id,
    projectAId: projectA.id,
    projectBId: projectB.id,
    pentesterId: pentester.id,
  };
}

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

async function criarFinding(c: Cenario, over: Partial<Parameters<typeof seedVulnerability>[0]> = {}) {
  const v = await seedVulnerability({
    projectId: c.projectAId,
    applicationId: c.appAId,
    companyId: c.companyAId,
    createdBy: c.pentesterId,
    ...over,
  });
  return v;
}

const pedir = (token: string, vulnId: string, body: object = {}) =>
  request(app)
    .post(`/api/vulnerabilities/${vulnId}/risk-acceptances`)
    .set(auth(token))
    .send({ reason: RAZAO, businessJustification: JUSTIFICATIVA, ...body });

const aprovar = (token: string, raId: string, body: object = {}) =>
  request(app)
    .post(`/api/risk-acceptances/${raId}/approve`)
    .set(auth(token))
    .send({ expiresAt: new Date(Date.now() + 30 * DIA_MS).toISOString(), ...body });

const listarAceites = (token: string, vulnId: string) =>
  request(app).get(`/api/vulnerabilities/${vulnId}/risk-acceptances`).set(auth(token));

const buscar = (token: string, qs = "") => request(app).get(`/api/vulnerabilities${qs}`).set(auth(token));

describe("Risk Acceptance (CP-4)", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it("RISK-ACC-01: solicitar → aprovar; a vulnerability continua ABERTA e o aceite fica vigente", async () => {
    const c = await montarCenario();
    const v = await criarFinding(c);

    const pedido = await pedir(c.ownerA, v.id);
    expect(pedido.status).toBe(201);
    expect(pedido.body).toMatchObject({ status: "REQUESTED", requestedByName: "Owner A", isActive: false });

    const ok = await aprovar(c.admin, pedido.body.id, { reviewNote: "Aceito pela diretoria." });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ status: "APPROVED", reviewedByName: "Admin", isActive: true });

    // a regra central: o finding NÃO muda de status
    const atual = await prisma.vulnerability.findUniqueOrThrow({ where: { id: v.id } });
    expect(atual.status).toBe("OPEN");

    const trilha = await prisma.auditLog.findMany({ where: { entityType: "RiskAcceptance" }, orderBy: { createdAt: "asc" } });
    expect(trilha.map((t) => t.action)).toEqual(["RISK_ACCEPTANCE_REQUESTED", "RISK_ACCEPTANCE_APPROVED"]);
    expect(trilha[1]!.companyId).toBe(c.companyAId);
  });

  it("RISK-ACC-02: rejeitar encerra o pedido e libera um novo", async () => {
    const c = await montarCenario();
    const v = await criarFinding(c);
    const pedido = await pedir(c.ownerA, v.id);

    const rej = await request(app)
      .post(`/api/risk-acceptances/${pedido.body.id}/reject`)
      .set(auth(c.admin))
      .send({ reviewNote: "Risco alto demais para o negócio." });
    expect(rej.status).toBe(200);
    expect(rej.body).toMatchObject({ status: "REJECTED", isActive: false });
    expect(rej.body.endedAt).not.toBeNull();

    // com o anterior terminal, um novo pedido é aceito
    expect((await pedir(c.ownerA, v.id)).status).toBe(201);
    const historico = await listarAceites(c.ownerA, v.id);
    expect(historico.body).toHaveLength(2);
  });

  it("RISK-ACC-03: revogar encerra o aceite vigente e registra quem revogou", async () => {
    const c = await montarCenario();
    const v = await criarFinding(c);
    const pedido = await pedir(c.ownerA, v.id);
    await aprovar(c.admin, pedido.body.id);

    const rev = await request(app)
      .post(`/api/risk-acceptances/${pedido.body.id}/revoke`)
      .set(auth(c.ownerA))
      .send({ reason: "Surgiu exploit público para esta falha." });
    expect(rev.status).toBe(200);
    expect(rev.body).toMatchObject({ status: "REVOKED", isActive: false, revokedByName: "Owner A" });
    expect(rev.body.endedAt).not.toBeNull();

    const audit = await prisma.auditLog.findFirst({ where: { action: "RISK_ACCEPTANCE_REVOKED" } });
    expect(JSON.parse(audit!.diffJson!).reason).toContain("exploit");
  });

  it("RISK-ACC-04: segundo pedido com um já em aberto → 409 (REQUESTED e APPROVED bloqueiam)", async () => {
    const c = await montarCenario();
    const v = await criarFinding(c);
    const pedido = await pedir(c.ownerA, v.id);

    const dup = await pedir(c.ownerA, v.id);
    expect(dup.status).toBe(409);
    expect(dup.body.error).toBe("RISK_ACCEPTANCE_ALREADY_ACTIVE");

    await aprovar(c.admin, pedido.body.id);
    const dup2 = await pedir(c.ownerA, v.id);
    expect(dup2.status).toBe(409);
  });

  it("RISK-ACC-05: solicitante NÃO aprova o próprio pedido — vale inclusive para ADMIN", async () => {
    const c = await montarCenario();
    const v = await criarFinding(c);

    const doOwner = await pedir(c.ownerA, v.id);
    const self = await aprovar(c.ownerA, doOwner.body.id);
    expect(self.status).toBe(403);
    expect(self.body.error).toBe("CANNOT_APPROVE_OWN_REQUEST");
    // rejeitar o próprio também não
    const selfRej = await request(app)
      .post(`/api/risk-acceptances/${doOwner.body.id}/reject`)
      .set(auth(c.ownerA))
      .send({ reviewNote: "mudei de ideia" });
    expect(selfRej.status).toBe(403);

    // outro OWNER da MESMA empresa pode
    expect((await aprovar(c.ownerA2, doOwner.body.id)).status).toBe(200);

    // e o mesmo vale para ADMIN: quem pede não assina
    const v2 = await criarFinding(c, { title: "outro" });
    const doAdmin = await pedir(c.admin, v2.id);
    expect((await aprovar(c.admin, doAdmin.body.id)).status).toBe(403);
    expect((await aprovar(c.admin2, doAdmin.body.id)).status).toBe(200);
  });

  it("RISK-ACC-06: CLIENT MEMBER não solicita nem decide → 403", async () => {
    const c = await montarCenario();
    const v = await criarFinding(c);
    expect((await pedir(c.memberA, v.id)).status).toBe(403);

    const pedido = await pedir(c.ownerA, v.id);
    expect((await aprovar(c.memberA, pedido.body.id)).status).toBe(403);
    // mas MEMBER continua podendo LER a trilha da própria empresa
    expect((await listarAceites(c.memberA, v.id)).status).toBe(200);
  });

  it("RISK-ACC-07: PENTESTER membro solicita, mas NUNCA aprova, rejeita ou revoga", async () => {
    const c = await montarCenario();
    const v = await criarFinding(c);

    const pedido = await pedir(c.pentester, v.id);
    expect(pedido.status).toBe(201);
    expect(pedido.body.requestedByName).toBe("Pen");

    expect((await aprovar(c.pentester, pedido.body.id)).status).toBe(403);
    await aprovar(c.admin, pedido.body.id);
    const rev = await request(app)
      .post(`/api/risk-acceptances/${pedido.body.id}/revoke`)
      .set(auth(c.pentester))
      .send({ reason: "tentativa indevida de revogação" });
    expect(rev.status).toBe(403);
  });

  it("RISK-ACC-08: PENTESTER não-membro do projeto não solicita nem lê → 403", async () => {
    const c = await montarCenario();
    const v = await criarFinding(c);
    expect((await pedir(c.pentesterFora, v.id)).status).toBe(403);
    expect((await listarAceites(c.pentesterFora, v.id)).status).toBe(403);
  });

  it("RISK-ACC-09: aceite decidido é IMUTÁVEL — não existe rota de edição", async () => {
    const c = await montarCenario();
    const v = await criarFinding(c);
    const pedido = await pedir(c.ownerA, v.id);
    await aprovar(c.admin, pedido.body.id);

    // nem PUT, nem PATCH: a API não expõe nenhum caminho de edição
    for (const metodo of ["put", "patch"] as const) {
      const r = await (request(app) as never as Record<string, (u: string) => request.Test>)[metodo](
        `/api/risk-acceptances/${pedido.body.id}`,
      )
        .set(auth(c.admin))
        .send({ reason: "reescrevendo a história", expiresAt: new Date(Date.now() + 999 * DIA_MS).toISOString() });
      expect([404, 405]).toContain(r.status);
    }

    const intacto = await prisma.riskAcceptance.findUniqueOrThrow({ where: { id: pedido.body.id } });
    expect(intacto.reason).toBe(RAZAO);
    // aprovar de novo também não: a transição exige REQUESTED
    expect((await aprovar(c.admin2, pedido.body.id)).status).toBe(422);
  });

  it("RISK-ACC-10: expiração preguiçosa normaliza, audita UMA vez e libera novo pedido", async () => {
    const c = await montarCenario();
    const v = await criarFinding(c);
    const pedido = await pedir(c.ownerA, v.id);
    await aprovar(c.admin, pedido.body.id);
    // força o vencimento no passado (o teto de 365d impede pedir isso pela API)
    await prisma.riskAcceptance.update({
      where: { id: pedido.body.id },
      data: { expiresAt: new Date(Date.now() - DIA_MS) },
    });

    // DUAS leituras concorrentes: só uma consolida, e só uma audita
    const [r1, r2] = await Promise.all([listarAceites(c.ownerA, v.id), listarAceites(c.ownerA, v.id)]);
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);

    const atual = await prisma.riskAcceptance.findUniqueOrThrow({ where: { id: pedido.body.id } });
    expect(atual.status).toBe("EXPIRED");
    expect(atual.endedAt).not.toBeNull();

    const eventos = await prisma.auditLog.findMany({ where: { action: "RISK_ACCEPTANCE_EXPIRED" } });
    expect(eventos).toHaveLength(1);
    expect(JSON.parse(eventos[0]!.diffJson!).system).toBe(true);

    // com o anterior expirado, um novo pedido passa
    expect((await pedir(c.ownerA, v.id)).status).toBe(201);
  });

  it("RISK-ACC-15: pedidos concorrentes deixam exatamente um aceite ativo", async () => {
    const c = await montarCenario();
    const v = await criarFinding(c);

    const respostas = await Promise.all([pedir(c.ownerA, v.id), pedir(c.ownerA2, v.id)]);
    expect(respostas.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await prisma.riskAcceptance.count({ where: { vulnerabilityId: v.id, status: "REQUESTED" } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { action: "RISK_ACCEPTANCE_REQUESTED" } })).toBe(1);
  });

  it("RISK-ACC-16: listagem e detalhe consolidam expiração e devolvem a pausa ao SLA", async () => {
    const c = await montarCenario();
    const v = await criarFinding(c);
    const findingDeOutraEmpresa = await criarFinding(c, {
      projectId: c.projectBId,
      applicationId: c.appBId,
      companyId: c.companyBId,
      createdBy: c.adminId,
      title: "finding de B não visível para A",
    });
    const aceiteDeB = await pedir(c.ownerB, findingDeOutraEmpresa.id);
    expect(aceiteDeB.status).toBe(201);
    await aprovar(c.admin, aceiteDeB.body.id);
    await prisma.riskAcceptance.update({
      where: { id: aceiteDeB.body.id },
      data: { expiresAt: new Date(Date.now() - DIA_MS) },
    });
    const estadoDeBAntes = await prisma.vulnerability.findUniqueOrThrow({ where: { id: findingDeOutraEmpresa.id } });
    await request(app).post(`/api/companies/${c.companyAId}/sla-policy/apply`).set(auth(c.admin));
    const antes = await prisma.vulnerability.findUniqueOrThrow({ where: { id: v.id } });

    const pedido = await pedir(c.ownerA, v.id);
    await aprovar(c.admin, pedido.body.id);
    const inicioPausa = new Date(Date.now() - 3 * DIA_MS);
    const fimPausa = new Date(Date.now() - DIA_MS);
    await prisma.riskAcceptance.update({
      where: { id: pedido.body.id },
      data: { reviewedAt: inicioPausa, expiresAt: fimPausa },
    });

    const lista = await buscar(c.ownerA, "?status=OPEN&pageSize=100");
    expect(lista.status).toBe(200);
    const linha = lista.body.data.find((item: { id: string }) => item.id === v.id);
    expect(linha.hasActiveRiskAcceptance).toBe(false);
    expect(linha.slaState).not.toBe("ACCEPTED");

    // Ler a company A não pode normalizar nem auditar o aceite vencido da B.
    const aceiteDeBPersistido = await prisma.riskAcceptance.findUniqueOrThrow({ where: { id: aceiteDeB.body.id } });
    expect(aceiteDeBPersistido.status).toBe("APPROVED");
    const estadoDeBDepois = await prisma.vulnerability.findUniqueOrThrow({ where: { id: findingDeOutraEmpresa.id } });
    expect(estadoDeBDepois.slaPausedMs).toBe(estadoDeBAntes.slaPausedMs);

    const detalhe = await request(app).get(`/api/vulnerabilities/${v.id}`).set(auth(c.ownerA));
    expect(detalhe.status).toBe(200);
    expect(detalhe.body.sla.pausedMs).toBeGreaterThanOrEqual(2 * DIA_MS - 60_000);

    const persistido = await prisma.riskAcceptance.findUniqueOrThrow({ where: { id: pedido.body.id } });
    expect(persistido.status).toBe("EXPIRED");
    const depois = await prisma.vulnerability.findUniqueOrThrow({ where: { id: v.id } });
    expect(depois.slaPausedMs).toBeGreaterThanOrEqual(2 * DIA_MS - 60_000);
    expect(depois.slaDueAt!.getTime()).toBeGreaterThanOrEqual(antes.slaDueAt!.getTime() + 2 * DIA_MS - 60_000);
    expect(await prisma.auditLog.count({ where: { entityId: pedido.body.id, action: "RISK_ACCEPTANCE_EXPIRED" } })).toBe(1);
  });

  it("RISK-ACC-11: SLA vira ACCEPTED enquanto vigente; VRS não muda; o finding segue aberto", async () => {
    const c = await montarCenario();
    const v = await criarFinding(c);
    await request(app).post(`/api/companies/${c.companyAId}/sla-policy/apply`).set(auth(c.admin));

    const antes = await request(app).get(`/api/vulnerabilities/${v.id}`).set(auth(c.ownerA));
    const vrsAntes = antes.body.vrs.score;
    expect(antes.body.sla.state).not.toBe("ACCEPTED");

    const pedido = await pedir(c.ownerA, v.id);
    await aprovar(c.admin, pedido.body.id);

    const depois = await request(app).get(`/api/vulnerabilities/${v.id}`).set(auth(c.ownerA));
    expect(depois.body.sla.state).toBe("ACCEPTED");
    expect(depois.body.status).toBe("OPEN");
    expect(depois.body.vrs.score).toBe(vrsAntes); // aceite NÃO mexe na prioridade

    // e na listagem o badge acompanha
    const lista = await buscar(c.ownerA, "?pageSize=100");
    const linha = lista.body.data.find((f: { id: string }) => f.id === v.id);
    expect(linha.slaState).toBe("ACCEPTED");
    expect(linha.hasActiveRiskAcceptance).toBe(true);
  });

  it("RISK-ACC-12: ao revogar, o tempo pausado volta ao relógio — dueAt e dueSoonAt deslocados", async () => {
    const c = await montarCenario();
    const v = await criarFinding(c);
    await request(app).post(`/api/companies/${c.companyAId}/sla-policy/apply`).set(auth(c.admin));
    const antes = await prisma.vulnerability.findUniqueOrThrow({ where: { id: v.id } });

    const pedido = await pedir(c.ownerA, v.id);
    await aprovar(c.admin, pedido.body.id);
    // simula 5 dias sob aceite, recuando a data de aprovação
    const cincoDiasAtras = new Date(Date.now() - 5 * DIA_MS);
    await prisma.riskAcceptance.update({ where: { id: pedido.body.id }, data: { reviewedAt: cincoDiasAtras } });

    await request(app)
      .post(`/api/risk-acceptances/${pedido.body.id}/revoke`)
      .set(auth(c.admin))
      .send({ reason: "Correção priorizada para esta semana." });

    const depois = await prisma.vulnerability.findUniqueOrThrow({ where: { id: v.id } });
    const deslocamento = depois.slaDueAt!.getTime() - antes.slaDueAt!.getTime();
    expect(deslocamento).toBeGreaterThanOrEqual(5 * DIA_MS - 60_000);
    expect(depois.slaDueSoonAt!.getTime() - antes.slaDueSoonAt!.getTime()).toBe(deslocamento);
    expect(depois.slaPausedMs).toBe(deslocamento);
    // o SLA volta a correr
    const detalhe = await request(app).get(`/api/vulnerabilities/${v.id}`).set(auth(c.ownerA));
    expect(detalhe.body.sla.state).not.toBe("ACCEPTED");
    expect(detalhe.body.sla.pausedMs).toBe(deslocamento);
  });

  it("RISK-ACC-13: validações — prazo passado, acima do teto, acima do pedido, textos curtos", async () => {
    const c = await montarCenario();
    const v = await criarFinding(c);

    expect((await pedir(c.ownerA, v.id, { reason: "curto" })).body.error).toBe("INVALID_REASON");
    expect((await pedir(c.ownerA, v.id, { businessJustification: "x" })).body.error).toBe("INVALID_BUSINESS_JUSTIFICATION");
    expect(
      (await pedir(c.ownerA, v.id, { requestedExpiresAt: new Date(Date.now() - DIA_MS).toISOString() })).body.error,
    ).toBe("INVALID_EXPIRES_AT");
    expect(
      (await pedir(c.ownerA, v.id, { requestedExpiresAt: new Date(Date.now() + 400 * DIA_MS).toISOString() })).body.error,
    ).toBe("INVALID_EXPIRES_AT");

    // pediu 10 dias: aprovar com 30 é alongar em silêncio → recusado; encurtar para 5 pode
    const pedido = await pedir(c.ownerA, v.id, {
      requestedExpiresAt: new Date(Date.now() + 10 * DIA_MS).toISOString(),
    });
    const alongar = await aprovar(c.admin, pedido.body.id, {
      expiresAt: new Date(Date.now() + 30 * DIA_MS).toISOString(),
    });
    expect(alongar.status).toBe(400);
    expect(alongar.body.error).toBe("EXPIRES_AT_EXCEEDS_REQUESTED");

    const passado = await aprovar(c.admin, pedido.body.id, { expiresAt: new Date(Date.now() - DIA_MS).toISOString() });
    expect(passado.body.error).toBe("INVALID_EXPIRES_AT");

    const encurtar = await aprovar(c.admin, pedido.body.id, {
      expiresAt: new Date(Date.now() + 5 * DIA_MS).toISOString(),
    });
    expect(encurtar.status).toBe(200);

    // revogar exige motivo
    const semMotivo = await request(app)
      .post(`/api/risk-acceptances/${pedido.body.id}/revoke`)
      .set(auth(c.admin))
      .send({ reason: "x" });
    expect(semMotivo.body.error).toBe("INVALID_REASON");
  });

  it("RISK-ACC-14: ?riskAcceptance= filtra por estado e os DOIS construtores concordam", async () => {
    const c = await montarCenario();
    const comAtivo = await criarFinding(c, { title: "com ativo" });
    const comExpirado = await criarFinding(c, { title: "com expirado" });
    const comPedido = await criarFinding(c, { title: "com pedido" });
    await criarFinding(c, { title: "sem nada" });

    const a = await pedir(c.ownerA, comAtivo.id);
    await aprovar(c.admin, a.body.id);
    const e = await pedir(c.ownerA, comExpirado.id);
    await aprovar(c.admin, e.body.id);
    await prisma.riskAcceptance.update({ where: { id: e.body.id }, data: { status: "EXPIRED", endedAt: new Date() } });
    await pedir(c.ownerA, comPedido.id);

    const titulos = async (qs: string) =>
      (await buscar(c.admin, qs)).body.data.map((f: { title: string }) => f.title).sort();
    expect(await titulos("?riskAcceptance=ACTIVE")).toEqual(["com ativo"]);
    expect(await titulos("?riskAcceptance=EXPIRED")).toEqual(["com expirado"]);
    expect(await titulos("?riskAcceptance=REQUESTED")).toEqual(["com pedido"]);
    expect(await titulos("?riskAcceptance=NONE")).toEqual(["sem nada"]);
    expect(await titulos("?riskAcceptance=ACTIVE,REQUESTED")).toEqual(["com ativo", "com pedido"]);

    for (const filtro of ["ACTIVE", "EXPIRED", "REQUESTED", "NONE", "ACTIVE,EXPIRED"]) {
      const sql = await buscar(c.admin, `?riskAcceptance=${filtro}&sortBy=severity`);
      const prismaQ = await buscar(c.admin, `?riskAcceptance=${filtro}&sortBy=createdAt`);
      expect(sql.body.data.map((f: { id: string }) => f.id).sort()).toEqual(
        prismaQ.body.data.map((f: { id: string }) => f.id).sort(),
      );
      expect(sql.body.pagination.total).toBe(prismaQ.body.pagination.total);
    }
    expect((await buscar(c.admin, "?riskAcceptance=SIM")).status).toBe(400);
  });

  it("TEN-32: CLIENT OWNER de B não lê, não pede e não decide aceite de A", async () => {
    const c = await montarCenario();
    const v = await criarFinding(c);
    const pedido = await pedir(c.ownerA, v.id);

    expect((await listarAceites(c.ownerB, v.id)).status).toBe(403);
    expect((await pedir(c.ownerB, v.id)).status).toBe(403);
    expect((await aprovar(c.ownerB, pedido.body.id)).status).toBe(403);
    const rej = await request(app)
      .post(`/api/risk-acceptances/${pedido.body.id}/reject`)
      .set(auth(c.ownerB))
      .send({ reviewNote: "não deveria conseguir" });
    expect(rej.status).toBe(403);

    // e nada mudou
    const intacto = await prisma.riskAcceptance.findUniqueOrThrow({ where: { id: pedido.body.id } });
    expect(intacto.status).toBe("REQUESTED");
    // nem aparece na busca dele
    const lista = await buscar(c.ownerB, "?riskAcceptance=REQUESTED");
    expect(lista.body.data).toEqual([]);
  });
});
