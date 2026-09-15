/**
 * dast-triage.test.ts
 *
 * Integração do que o pentester faz DEPOIS que o scan termina (ADR-032):
 * triar, promover pra Vulnerability e comparar duas execuções.
 *
 * Como o resto da suíte do módulo, roda com `DAST_FORCE_SIMULATE=true` do
 * .env.test — nenhum teste aqui depende de Docker ou de rede. O que está sendo
 * exercitado não é o scanner, é o que se faz com o resultado dele.
 *
 *   DAST-TRI-01  triar grava status, nota, autor e data
 *   DAST-TRI-02  status de triagem inválido -> 400
 *   DAST-TRI-03  PENTESTER não tria finding de scan alheio -> 403; ADMIN tria
 *   DAST-TRI-04  triagem gera AuditLog
 *   DAST-PRO-01  rascunho vem preenchido, com vetor sugerido e proveniência
 *   DAST-PRO-02  promover cria Vulnerability com score CALCULADO do vetor (RN10)
 *   DAST-PRO-03  promover duas vezes -> 409 (dedup garantido por UNIQUE)
 *   DAST-PRO-04  vetor CVSS malformado -> 400, e NADA é criado
 *   DAST-PRO-05  promover pra projeto onde não é membro -> 403
 *   DAST-PRO-06  promover marca o finding como CONFIRMED
 *   DAST-PRO-07  apagar o scan de origem NÃO apaga a Vulnerability (SetNull)
 *   DAST-CMP-01  diff classifica resolvido / novo / persistente por fingerprint
 *   DAST-CMP-02  comparar alvos diferentes -> 422
 *   DAST-CMP-03  comparar scan consigo mesmo -> 400
 *   DAST-RBAC-10 CLIENT recebe 403 nas rotas novas
 */

import request from "supertest";
import { app } from "../../src/app";
import { cleanDatabase } from "../setup";
import { prisma } from "../../src/database/prisma.database";
import { seedUser } from "../fixtures/users.fixture";
import { loginAs } from "../fixtures/auth.fixture";
import { seedPlan } from "../fixtures/plans.fixture";
import { seedCompany } from "../fixtures/companies.fixture";
import { seedApplication } from "../fixtures/applications.fixture";
import { seedProject, seedProjectMember } from "../fixtures/projects.fixture";

const PASSWORD = "senha12345";
const VETOR_VALIDO = "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForTerminalStatus(token: string, scanId: string, maxMs = 8000): Promise<any> {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    const res = await request(app).get(`/api/dast/scans/${scanId}`).set("Authorization", `Bearer ${token}`);
    if (["COMPLETED", "FAILED", "CANCELLED"].includes(res.body.status)) return res.body;
    await sleep(150);
  }
  throw new Error(`scan ${scanId} não chegou a estado terminal em ${maxMs}ms`);
}

/** Cria um scan já concluído (simulado) e devolve o scan + seus findings. */
async function scanConcluido(token: string, targetUrl: string) {
  const criado = await request(app)
    .post("/api/dast/scans")
    .set("Authorization", `Bearer ${token}`)
    .send({ targetUrl });
  expect(criado.status).toBe(201);
  await waitForTerminalStatus(token, criado.body.id);

  const findings = await request(app)
    .get(`/api/dast/scans/${criado.body.id}/findings`)
    .set("Authorization", `Bearer ${token}`);
  expect(findings.body.length).toBeGreaterThan(0);
  return { scanId: criado.body.id as string, findings: findings.body as any[] };
}

/**
 * Monta a cadeia Company -> Application -> Project e mete o pentester como
 * membro. A promoção precisa dela inteira: uma Vulnerability herda
 * applicationId e companyId do Project (RN09).
 */
async function seedCadeiaDeProjeto(userId: string, nome = "Projeto Destino") {
  const plan = await seedPlan({ name: `Plano ${nome}`, maxApplications: 10, maxProjects: 10, price: 0 });
  const company = await seedCompany({ name: `Empresa ${nome}`, planId: plan.id });
  const application = await seedApplication({ name: `App ${nome}`, companyId: company.id });
  const project = await seedProject({ name: nome, applicationId: application.id, companyId: company.id });
  await seedProjectMember(project.id, userId);
  return { project, application, company };
}

async function seedActors() {
  const admin = await seedUser({ name: "Admin", email: "admin@vulnera.local", password: PASSWORD, role: "ADMIN" });
  const pentesterA = await seedUser({ name: "Pentester A", email: "penta@vulnera.local", password: PASSWORD, role: "PENTESTER" });
  const pentesterB = await seedUser({ name: "Pentester B", email: "pentb@vulnera.local", password: PASSWORD, role: "PENTESTER" });
  const client = await seedUser({ name: "Client", email: "client@vulnera.local", password: PASSWORD, role: "CLIENT" });

  return {
    admin,
    pentesterA,
    pentesterB,
    client,
    adminToken: await loginAs(app, admin.email, PASSWORD),
    pentesterAToken: await loginAs(app, pentesterA.email, PASSWORD),
    pentesterBToken: await loginAs(app, pentesterB.email, PASSWORD),
    clientToken: await loginAs(app, client.email, PASSWORD),
  };
}

beforeEach(async () => {
  await cleanDatabase();
});

describe("DAST — triagem de findings", () => {
  it("DAST-TRI-01 — triar grava status, nota, autor e data", async () => {
    const { pentesterAToken } = await seedActors();
    const { findings } = await scanConcluido(pentesterAToken, "https://triagem-01.test");

    // Todo finding nasce por triar — é o que faz o contador "N por triar" da
    // UI significar alguma coisa.
    expect(findings.every((f) => f.triageStatus === "NEW")).toBe(true);

    const res = await request(app)
      .patch(`/api/dast/scans/findings/${findings[0].id}/triage`)
      .set("Authorization", `Bearer ${pentesterAToken}`)
      .send({ triageStatus: "FALSE_POSITIVE", note: "Header ausente por design nesta rota." });

    expect(res.status).toBe(200);
    expect(res.body.triageStatus).toBe("FALSE_POSITIVE");
    expect(res.body.triageNote).toContain("por design");
    expect(res.body.triagedByName).toBe("Pentester A");
    expect(res.body.triagedAt).toBeTruthy();
  });

  it("DAST-TRI-02 — status de triagem inválido é recusado com 400", async () => {
    const { pentesterAToken } = await seedActors();
    const { findings } = await scanConcluido(pentesterAToken, "https://triagem-02.test");

    const res = await request(app)
      .patch(`/api/dast/scans/findings/${findings[0].id}/triage`)
      .set("Authorization", `Bearer ${pentesterAToken}`)
      .send({ triageStatus: "QUASE_CERTO" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("INVALID_TRIAGE_STATUS");
  });

  it("DAST-TRI-03 — PENTESTER não tria finding de scan alheio; ADMIN tria", async () => {
    const { pentesterAToken, pentesterBToken, adminToken } = await seedActors();
    const { findings } = await scanConcluido(pentesterAToken, "https://triagem-03.test");

    const alheio = await request(app)
      .patch(`/api/dast/scans/findings/${findings[0].id}/triage`)
      .set("Authorization", `Bearer ${pentesterBToken}`)
      .send({ triageStatus: "CONFIRMED" });
    expect(alheio.status).toBe(403);

    const comoAdmin = await request(app)
      .patch(`/api/dast/scans/findings/${findings[0].id}/triage`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ triageStatus: "CONFIRMED" });
    expect(comoAdmin.status).toBe(200);
  });

  it("DAST-TRI-04 — triagem deixa rastro no AuditLog", async () => {
    const { pentesterAToken } = await seedActors();
    const { findings } = await scanConcluido(pentesterAToken, "https://triagem-04.test");

    await request(app)
      .patch(`/api/dast/scans/findings/${findings[0].id}/triage`)
      .set("Authorization", `Bearer ${pentesterAToken}`)
      .send({ triageStatus: "ACCEPTED_RISK" });

    const logs = await prisma.auditLog.findMany({ where: { entityType: "DastFinding", entityId: findings[0].id } });
    expect(logs).toHaveLength(1);
    expect(logs[0].action).toBe("STATUS_CHANGE");
    expect(logs[0].diffJson).toContain("ACCEPTED_RISK");
  });
});

describe("DAST — promoção para Vulnerability", () => {
  it("DAST-PRO-01 — rascunho vem preenchido, com vetor sugerido e a proveniência na descrição", async () => {
    const { pentesterA, pentesterAToken } = await seedActors();
    await seedCadeiaDeProjeto(pentesterA.id);
    const { findings } = await scanConcluido(pentesterAToken, "https://promocao-01.test");

    const res = await request(app)
      .get(`/api/dast/scans/findings/${findings[0].id}/promotion-draft`)
      .set("Authorization", `Bearer ${pentesterAToken}`);

    expect(res.status).toBe(200);
    expect(res.body.cvssVector).toMatch(/^CVSS:3\.1\//);
    expect(res.body.owaspCategory).toMatch(/^A\d{2}$/);
    expect(res.body.title).toBe(findings[0].title);
    // A proveniência precisa estar no TEXTO, não só numa coluna: quem abrir a
    // vulnerability meses depois tem que ver de onde ela veio.
    expect(res.body.description).toContain("Origem (scan DAST automatizado)");
    expect(res.body.description).toContain("promocao-01.test");
    expect(res.body.alreadyPromotedTo).toBeNull();
  });

  it("DAST-PRO-02 — promover cria Vulnerability com score calculado do vetor revisado (RN10)", async () => {
    const { pentesterA, pentesterAToken } = await seedActors();
    const { project, application, company } = await seedCadeiaDeProjeto(pentesterA.id);
    const { scanId, findings } = await scanConcluido(pentesterAToken, "https://promocao-02.test");

    const res = await request(app)
      .post(`/api/dast/scans/findings/${findings[0].id}/promote`)
      .set("Authorization", `Bearer ${pentesterAToken}`)
      .send({
        projectId: project.id,
        title: "SQL Injection em /busca",
        description: "Descrição revisada pelo pentester.",
        owaspCategory: "A03",
        cvssVector: VETOR_VALIDO,
      });

    expect(res.status).toBe(201);
    // 9.8 é o score oficial deste vetor — o mesmo cálculo de uma vulnerability
    // digitada à mão. Promover NÃO abre uma exceção na RN10.
    expect(res.body.cvssScore).toBe(9.8);
    expect(res.body.severityCalculated).toBe("CRITICAL");
    expect(res.body.severityFinal).toBe("CRITICAL");
    expect(res.body.sourceType).toBe("DAST_IMPORT");
    expect(res.body.sourceDastFindingId).toBe(findings[0].id);
    // RN09 — application e company herdadas do Project, não informadas pelo cliente
    expect(res.body.applicationId).toBe(application.id);
    expect(res.body.companyId).toBe(company.id);

    // o finding passa a apontar de volta pra vulnerability
    const relidos = await request(app)
      .get(`/api/dast/scans/${scanId}/findings`)
      .set("Authorization", `Bearer ${pentesterAToken}`);
    const promovido = relidos.body.find((f: any) => f.id === findings[0].id);
    expect(promovido.promotedVulnerability.id).toBe(res.body.id);
  });

  it("DAST-PRO-03 — promover o mesmo finding duas vezes devolve 409", async () => {
    const { pentesterA, pentesterAToken } = await seedActors();
    const { project } = await seedCadeiaDeProjeto(pentesterA.id);
    const { findings } = await scanConcluido(pentesterAToken, "https://promocao-03.test");

    const payload = {
      projectId: project.id,
      title: "Achado",
      description: "Descrição.",
      owaspCategory: "A03",
      cvssVector: VETOR_VALIDO,
    };

    const primeira = await request(app)
      .post(`/api/dast/scans/findings/${findings[0].id}/promote`)
      .set("Authorization", `Bearer ${pentesterAToken}`)
      .send(payload);
    expect(primeira.status).toBe(201);

    const segunda = await request(app)
      .post(`/api/dast/scans/findings/${findings[0].id}/promote`)
      .set("Authorization", `Bearer ${pentesterAToken}`)
      .send(payload);
    expect(segunda.status).toBe(409);
    expect(segunda.body.error).toBe("FINDING_ALREADY_PROMOTED");

    // e o banco continua com UMA só
    expect(await prisma.vulnerability.count({ where: { sourceDastFindingId: findings[0].id } })).toBe(1);
  });

  it("DAST-PRO-03b — duas promoções SIMULTÂNEAS do mesmo finding: uma cria, a outra devolve 409", async () => {
    const { pentesterA, pentesterAToken } = await seedActors();
    const { project } = await seedCadeiaDeProjeto(pentesterA.id);
    const { findings } = await scanConcluido(pentesterAToken, "https://promocao-03b.test");

    const payload = {
      projectId: project.id,
      title: "Achado disputado",
      description: "Descrição.",
      owaspCategory: "A03",
      cvssVector: VETOR_VALIDO,
    };

    // Dispara as duas ANTES de esperar qualquer uma: é a janela real entre a
    // checagem de "já promovido?" e o insert. Sem o tratamento do P2002, a
    // segunda vazaria como 500 em vez de 409.
    const [a, b] = await Promise.all([
      request(app).post(`/api/dast/scans/findings/${findings[0].id}/promote`).set("Authorization", `Bearer ${pentesterAToken}`).send(payload),
      request(app).post(`/api/dast/scans/findings/${findings[0].id}/promote`).set("Authorization", `Bearer ${pentesterAToken}`).send(payload),
    ]);

    const status = [a.status, b.status].sort();
    expect(status).toEqual([201, 409]);
    // O que realmente importa: o banco não ficou com duas.
    expect(await prisma.vulnerability.count({ where: { sourceDastFindingId: findings[0].id } })).toBe(1);
  });

  it("DAST-PRO-04 — vetor CVSS malformado devolve 400 e não cria nada", async () => {
    const { pentesterA, pentesterAToken } = await seedActors();
    const { project } = await seedCadeiaDeProjeto(pentesterA.id);
    const { findings } = await scanConcluido(pentesterAToken, "https://promocao-04.test");

    const res = await request(app)
      .post(`/api/dast/scans/findings/${findings[0].id}/promote`)
      .set("Authorization", `Bearer ${pentesterAToken}`)
      .send({
        projectId: project.id,
        title: "Achado",
        description: "Descrição.",
        owaspCategory: "A03",
        cvssVector: "CVSS:3.1/ISSO/NAO/E/UM/VETOR",
      });

    // 400 e não 500: o vetor é input do usuário (ele edita a sugestão na tela).
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("INVALID_CVSS_VECTOR");
    expect(await prisma.vulnerability.count()).toBe(0);
  });

  it("DAST-PRO-05 — promover para projeto onde não é membro devolve 403", async () => {
    const { pentesterA, pentesterB, pentesterAToken } = await seedActors();
    // O projeto pertence ao B; o A tem o scan mas não participa do projeto.
    const { project } = await seedCadeiaDeProjeto(pentesterB.id, "Projeto do B");
    const { findings } = await scanConcluido(pentesterAToken, "https://promocao-05.test");
    expect(pentesterA.id).not.toBe(pentesterB.id);

    const res = await request(app)
      .post(`/api/dast/scans/findings/${findings[0].id}/promote`)
      .set("Authorization", `Bearer ${pentesterAToken}`)
      .send({
        projectId: project.id,
        title: "Achado",
        description: "Descrição.",
        owaspCategory: "A03",
        cvssVector: VETOR_VALIDO,
      });

    // Promover não pode ser porta lateral pra escrever em projeto alheio.
    expect(res.status).toBe(403);
    expect(await prisma.vulnerability.count()).toBe(0);
  });

  it("DAST-PRO-06 — promover um finding ainda NEW marca ele como CONFIRMED", async () => {
    const { pentesterA, pentesterAToken } = await seedActors();
    const { project } = await seedCadeiaDeProjeto(pentesterA.id);
    const { findings } = await scanConcluido(pentesterAToken, "https://promocao-06.test");

    await request(app)
      .post(`/api/dast/scans/findings/${findings[0].id}/promote`)
      .set("Authorization", `Bearer ${pentesterAToken}`)
      .send({
        projectId: project.id,
        title: "Achado",
        description: "Descrição.",
        owaspCategory: "A03",
        cvssVector: VETOR_VALIDO,
      });

    const atualizado = await prisma.dastFinding.findUnique({ where: { id: findings[0].id } });
    expect(atualizado?.triageStatus).toBe("CONFIRMED");
  });

  it("DAST-PRO-07 — apagar o scan de origem NÃO apaga a Vulnerability promovida", async () => {
    const { pentesterA, pentesterAToken } = await seedActors();
    const { project } = await seedCadeiaDeProjeto(pentesterA.id);
    const { scanId, findings } = await scanConcluido(pentesterAToken, "https://promocao-07.test");

    const promovida = await request(app)
      .post(`/api/dast/scans/findings/${findings[0].id}/promote`)
      .set("Authorization", `Bearer ${pentesterAToken}`)
      .send({
        projectId: project.id,
        title: "Achado que sobrevive",
        description: "Descrição.",
        owaspCategory: "A03",
        cvssVector: VETOR_VALIDO,
      });
    expect(promovida.status).toBe(201);

    // Cascade apaga os findings junto com o scan; a FK da Vulnerability é
    // SetNull justamente pra ela sobreviver a isso.
    await prisma.dastScan.delete({ where: { id: scanId } });

    const sobrevivente = await prisma.vulnerability.findUnique({ where: { id: promovida.body.id } });
    expect(sobrevivente).not.toBeNull();
    expect(sobrevivente?.title).toBe("Achado que sobrevive");
    expect(sobrevivente?.sourceDastFindingId).toBeNull(); // perde o ponteiro, não o achado
    expect(sobrevivente?.sourceType).toBe("DAST_IMPORT"); // a origem continua registrada
  });
});

describe("DAST — comparação entre execuções", () => {
  it("DAST-CMP-01 — classifica resolvido, novo e persistente por fingerprint", async () => {
    const { pentesterAToken } = await seedActors();
    const alvo = "https://comparacao-01.test";

    const antigo = await scanConcluido(pentesterAToken, alvo);
    const novo = await scanConcluido(pentesterAToken, alvo);

    // Os dois scans simulados nascem idênticos. Pra provar que o diff sabe
    // classificar, mexemos no banco: um finding só do antigo (= resolvido) e
    // um só do novo (= introduzido).
    const doAntigo = await prisma.dastFinding.findMany({ where: { scanId: antigo.scanId } });
    const doNovo = await prisma.dastFinding.findMany({ where: { scanId: novo.scanId } });
    const totalOriginal = doAntigo.length;

    await prisma.dastFinding.delete({ where: { id: doNovo[0].id } }); // sumiu no novo -> resolvido
    await prisma.dastFinding.delete({ where: { id: doAntigo[1].id } }); // só existe no novo -> introduzido

    const res = await request(app)
      .get(`/api/dast/scans/${novo.scanId}/compare?base=${antigo.scanId}`)
      .set("Authorization", `Bearer ${pentesterAToken}`);

    expect(res.status).toBe(200);
    expect(res.body.resolved).toHaveLength(1);
    expect(res.body.resolved[0].fingerprint).toBe(doNovo[0].fingerprint);
    expect(res.body.introduced).toHaveLength(1);
    expect(res.body.introduced[0].fingerprint).toBe(doAntigo[1].fingerprint);
    expect(res.body.persisted).toHaveLength(totalOriginal - 2);
  });

  it("DAST-CMP-02 — comparar scans de alvos diferentes devolve 422", async () => {
    const { pentesterAToken } = await seedActors();
    const a = await scanConcluido(pentesterAToken, "https://alvo-a.test");
    const b = await scanConcluido(pentesterAToken, "https://alvo-b.test");

    const res = await request(app)
      .get(`/api/dast/scans/${b.scanId}/compare?base=${a.scanId}`)
      .set("Authorization", `Bearer ${pentesterAToken}`);

    // Alvos diferentes dariam 100% "sumiu" + 100% "apareceu": correto e inútil.
    expect(res.status).toBe(422);
    expect(res.body.error).toBe("SCANS_TARGET_MISMATCH");
  });

  it("DAST-CMP-03 — comparar um scan consigo mesmo devolve 400", async () => {
    const { pentesterAToken } = await seedActors();
    const { scanId } = await scanConcluido(pentesterAToken, "https://comparacao-03.test");

    const res = await request(app)
      .get(`/api/dast/scans/${scanId}/compare?base=${scanId}`)
      .set("Authorization", `Bearer ${pentesterAToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("CANNOT_COMPARE_SCAN_WITH_ITSELF");
  });

  it("lista de comparáveis traz só execuções concluídas do MESMO alvo", async () => {
    const { pentesterAToken } = await seedActors();
    const alvo = "https://comparaveis.test";
    const primeiro = await scanConcluido(pentesterAToken, alvo);
    const segundo = await scanConcluido(pentesterAToken, alvo);
    await scanConcluido(pentesterAToken, "https://outro-alvo.test");

    const res = await request(app)
      .get(`/api/dast/scans/${segundo.scanId}/comparable`)
      .set("Authorization", `Bearer ${pentesterAToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(primeiro.scanId);
    expect(res.body[0].total).toBeGreaterThan(0);
  });
});

describe("DAST — RBAC das rotas novas", () => {
  it("DAST-RBAC-10 — CLIENT recebe 403 em triagem, promoção e comparação", async () => {
    const { clientToken } = await seedActors();
    const auth = { Authorization: `Bearer ${clientToken}` };
    const fakeId = "id-que-nao-existe";

    const chamadas = [
      request(app).patch(`/api/dast/scans/findings/${fakeId}/triage`).set(auth).send({ triageStatus: "CONFIRMED" }),
      request(app).get(`/api/dast/scans/findings/${fakeId}/promotion-draft`).set(auth),
      request(app).post(`/api/dast/scans/findings/${fakeId}/promote`).set(auth).send({}),
      request(app).get(`/api/dast/scans/${fakeId}/comparable`).set(auth),
      request(app).get(`/api/dast/scans/${fakeId}/compare?base=x`).set(auth),
    ];

    for (const res of await Promise.all(chamadas)) {
      expect(res.status).toBe(403);
    }
  });
});
