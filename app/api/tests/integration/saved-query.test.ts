/**
 * saved-query.test.ts (integration)
 *
 * Buscas salvas e watchlists (CP-6 — docs/DECISIONS.md D6) contra a API e o
 * banco reais.
 *
 * O teste central desta suíte é o SQ-09: a MESMA watchlist, aberta por duas
 * pessoas diferentes, devolve conjuntos diferentes de findings. É o que prova
 * que a busca salva guarda a PERGUNTA e não a RESPOSTA — se guardasse um
 * snapshot, as duas veriam a mesma lista, e uma delas estaria vendo o que não
 * pode.
 *
 *   SQ-01  criar, listar, abrir e remover uma busca privada
 *   SQ-02  a query é canonizada na escrita (ordem, duplicata, page)
 *   SQ-03  parâmetro inválido é descartado e relatado a quem salvou
 *   SQ-04  busca privada de A é invisível para B (404, não 403)
 *   SQ-05  watchlist COMPANY é visível para o time; editável só pelo dono
 *   SQ-06  PENTESTER não compartilha com empresa nenhuma
 *   SQ-07  limites: fixadas por pessoa, total por pessoa, nome repetido
 *   SQ-08  mesma pergunta salva duas vezes é recusada
 *   SQ-09  a watchlist reexecuta com o escopo de QUEM ABRE
 *   SQ-10  a query salva não é passe de acesso: companyId alheio não vaza
 *   TEN-34 canário de tenancy das buscas salvas
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
import { SAVED_QUERY_LIMITS } from "../../src/models/saved-query.model";

const PASSWORD = "senha12345";
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

type Cenario = {
  admin: string;
  ownerA: string;
  ownerA2: string;
  ownerB: string;
  pentester: string;
  ownerAId: string;
  companyAId: string;
  companyBId: string;
  projectAId: string;
  appAId: string;
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
  const ownerA = await seedUser({
    name: "Owner A", email: "owner-a@v.local", password: PASSWORD, role: "CLIENT",
    companyId: companyA.id, companyRole: "OWNER",
  });
  const ownerA2 = await seedUser({
    name: "Owner A2", email: "owner-a2@v.local", password: PASSWORD, role: "CLIENT",
    companyId: companyA.id, companyRole: "MEMBER",
  });
  const ownerB = await seedUser({
    name: "Owner B", email: "owner-b@v.local", password: PASSWORD, role: "CLIENT",
    companyId: companyB.id, companyRole: "OWNER",
  });
  const pentester = await seedUser({ name: "Pen", email: "pen@v.local", password: PASSWORD, role: "PENTESTER" });

  const appA = await seedApplication({ name: "App A", companyId: companyA.id });
  const projectA = await seedProject({ name: "Proj A", applicationId: appA.id, companyId: companyA.id });
  await seedProjectMember(projectA.id, pentester.id);

  return {
    admin: await loginAs(app, admin.email, PASSWORD),
    ownerA: await loginAs(app, ownerA.email, PASSWORD),
    ownerA2: await loginAs(app, ownerA2.email, PASSWORD),
    ownerB: await loginAs(app, ownerB.email, PASSWORD),
    pentester: await loginAs(app, pentester.email, PASSWORD),
    ownerAId: ownerA.id,
    companyAId: companyA.id,
    companyBId: companyB.id,
    projectAId: projectA.id,
    appAId: appA.id,
    pentesterId: pentester.id,
  };
}

const salvar = (token: string, body: Record<string, unknown>) =>
  request(app).post("/api/saved-queries").set(auth(token)).send(body);

describe("Saved Queries / Watchlists (CP-6)", () => {
  let c: Cenario;

  beforeEach(async () => {
    await cleanDatabase();
    c = await montarCenario();
  });

  it("SQ-01 cria, lista, abre e remove uma busca privada", async () => {
    const criada = await salvar(c.ownerA, {
      name: "Críticas abertas",
      description: "O que precisa de atenção hoje.",
      queryString: "severity=CRITICAL&status=OPEN",
    });
    expect(criada.status).toBe(201);
    expect(criada.body.scope).toBe("PRIVATE"); // padrão
    expect(criada.body.isOwner).toBe(true);
    expect(criada.body.pinned).toBe(false);
    expect(criada.body.filtros).toEqual([
      { campo: "severity", valores: ["CRITICAL"] },
      { campo: "status", valores: ["OPEN"] },
    ]);

    const lista = await request(app).get("/api/saved-queries").set(auth(c.ownerA));
    expect(lista.status).toBe(200);
    expect(lista.body).toHaveLength(1);

    const detalhe = await request(app).get(`/api/saved-queries/${criada.body.id}`).set(auth(c.ownerA));
    expect(detalhe.status).toBe(200);
    expect(detalhe.body.queryString).toBe("severity=CRITICAL&status=OPEN");

    expect((await request(app).delete(`/api/saved-queries/${criada.body.id}`).set(auth(c.ownerA))).status).toBe(204);
    expect((await request(app).get("/api/saved-queries").set(auth(c.ownerA))).body).toHaveLength(0);
  });

  it("SQ-02 canoniza a query na escrita", async () => {
    const r = await salvar(c.ownerA, {
      name: "Bagunçada",
      // Ordem trocada, valor repetido, página — tudo isso é a MESMA busca.
      queryString: "?status=OPEN&severity=HIGH,CRITICAL,HIGH&page=4&pageSize=100",
    });
    expect(r.status).toBe(201);
    expect(r.body.queryString).toBe("severity=CRITICAL,HIGH&status=OPEN");
    // Nada foi descartado por erro: page/pageSize saem por decisão de produto.
    expect(r.body.descartados).toHaveLength(0);
  });

  it("SQ-03 descarta parâmetro inválido e conta a quem salvou", async () => {
    const r = await salvar(c.ownerA, {
      name: "Com lixo",
      queryString: "severity=HIGH&naoExiste=1&projectId=curto",
    });
    expect(r.status).toBe(201);
    expect(r.body.queryString).toBe("severity=HIGH");
    const params = r.body.descartados.map((d: { param: string }) => d.param);
    expect(params).toEqual(expect.arrayContaining(["naoExiste", "projectId=curto"]));

    // E uma busca que sobra vazia depois do descarte é recusada, não salva vazia.
    const vazia = await salvar(c.ownerA, { name: "Só lixo", queryString: "naoExiste=1" });
    expect(vazia.status).toBe(400);
    expect(vazia.body.error).toBe("EMPTY_QUERY");
  });

  it("SQ-04 busca privada de A é invisível para B — 404, não 403", async () => {
    const daA = await salvar(c.ownerA, { name: "Minha", queryString: "status=OPEN" });

    const lista = await request(app).get("/api/saved-queries").set(auth(c.ownerB));
    expect(lista.body).toHaveLength(0);

    // 404 de propósito: um 403 confirmaria que o id existe.
    const get = await request(app).get(`/api/saved-queries/${daA.body.id}`).set(auth(c.ownerB));
    expect(get.status).toBe(404);
    expect((await request(app).delete(`/api/saved-queries/${daA.body.id}`).set(auth(c.ownerB))).status).toBe(404);

    // Nem para outra pessoa da PRÓPRIA empresa: privada é privada.
    expect((await request(app).get(`/api/saved-queries/${daA.body.id}`).set(auth(c.ownerA2))).status).toBe(404);
  });

  it("SQ-05 watchlist COMPANY é do time para ler e do dono para editar", async () => {
    const watchlist = await salvar(c.ownerA, {
      name: "Estouradas do time",
      queryString: "slaState=BREACHED",
      scope: "COMPANY",
    });
    expect(watchlist.status).toBe(201);
    expect(watchlist.body.scope).toBe("COMPANY");
    expect(watchlist.body.companyId).toBe(c.companyAId);

    // Colega da mesma empresa VÊ...
    const doColega = await request(app).get(`/api/saved-queries/${watchlist.body.id}`).set(auth(c.ownerA2));
    expect(doColega.status).toBe(200);
    expect(doColega.body.isOwner).toBe(false);
    expect((await request(app).get("/api/saved-queries").set(auth(c.ownerA2))).body).toHaveLength(1);

    // ...mas NÃO edita nem remove.
    const put = await request(app)
      .put(`/api/saved-queries/${watchlist.body.id}`)
      .set(auth(c.ownerA2))
      .send({ name: "Sequestrada" });
    expect(put.status).toBe(403);
    expect((await request(app).delete(`/api/saved-queries/${watchlist.body.id}`).set(auth(c.ownerA2))).status).toBe(403);

    // E a empresa B não vê nada disso.
    expect((await request(app).get("/api/saved-queries").set(auth(c.ownerB))).body).toHaveLength(0);
  });

  it("SQ-06 PENTESTER não compartilha busca com empresa nenhuma", async () => {
    // Ele atravessa empresas — "compartilhar com a empresa" não teria destinatário.
    const r = await salvar(c.pentester, {
      name: "Meus projetos",
      queryString: "status=OPEN",
      scope: "COMPANY",
    });
    expect(r.status).toBe(403);
    expect(r.body.error).toBe("PENTESTER_CANNOT_SHARE_QUERY");

    // A privada, essa sim, funciona.
    const privada = await salvar(c.pentester, { name: "Meus projetos", queryString: "status=OPEN" });
    expect(privada.status).toBe(201);
    expect(privada.body.scope).toBe("PRIVATE");
    expect(privada.body.companyId).toBeNull();

    // E tentar promover depois também é barrado.
    const promover = await request(app)
      .put(`/api/saved-queries/${privada.body.id}`)
      .set(auth(c.pentester))
      .send({ scope: "COMPANY" });
    expect(promover.status).toBe(403);
  });

  it("SQ-07 respeita os limites de fixadas, de total e de nome repetido", async () => {
    for (let i = 0; i < SAVED_QUERY_LIMITS.maxPinned; i++) {
      const r = await salvar(c.ownerA, {
        name: `Fixada ${i}`,
        queryString: `severity=HIGH&vrsMin=${i}`,
        pinned: true,
      });
      expect(r.status).toBe(201);
    }

    const excedente = await salvar(c.ownerA, { name: "Mais uma", queryString: "severity=LOW", pinned: true });
    expect(excedente.status).toBe(422);
    expect(excedente.body.error).toBe("PINNED_LIMIT_REACHED");

    // Sem fixar, entra normalmente.
    const semFixar = await salvar(c.ownerA, { name: "Mais uma", queryString: "severity=LOW" });
    expect(semFixar.status).toBe(201);

    // Nome repetido do MESMO dono é recusado...
    const repetida = await salvar(c.ownerA, { name: "Mais uma", queryString: "severity=MEDIUM" });
    expect(repetida.status).toBe(409);
    expect(repetida.body.error).toBe("SAVED_QUERY_NAME_TAKEN");

    // ...mas o mesmo nome em OUTRA pessoa é livre.
    expect((await salvar(c.ownerB, { name: "Mais uma", queryString: "severity=LOW" })).status).toBe(201);

    // Só as fixadas quando pedido.
    const fixadas = await request(app).get("/api/saved-queries?pinned=true").set(auth(c.ownerA));
    expect(fixadas.body).toHaveLength(SAVED_QUERY_LIMITS.maxPinned);
    expect(fixadas.body.every((q: { pinned: boolean }) => q.pinned)).toBe(true);
  });

  it("SQ-08 a mesma pergunta salva duas vezes é recusada", async () => {
    expect((await salvar(c.ownerA, { name: "Abertas", queryString: "status=OPEN&severity=HIGH" })).status).toBe(201);

    // Mesma busca, ordem diferente, nome diferente: continua sendo a mesma pergunta.
    const duplicada = await salvar(c.ownerA, { name: "Outro nome", queryString: "severity=HIGH&status=OPEN" });
    expect(duplicada.status).toBe(409);
    expect(duplicada.body.error).toBe("SAVED_QUERY_ALREADY_EXISTS");
  });

  it("SQ-11 editar query para a pergunta canônica de outra busca é recusado", async () => {
    const primeira = await salvar(c.ownerA, { name: "Críticas", queryString: "severity=HIGH&status=OPEN" });
    const segunda = await salvar(c.ownerA, { name: "Vencidas", queryString: "slaState=BREACHED" });

    const duplicada = await request(app)
      .put(`/api/saved-queries/${segunda.body.id}`)
      .set(auth(c.ownerA))
      .send({ queryString: "status=OPEN&severity=HIGH" });
    expect(duplicada.status).toBe(409);
    expect(duplicada.body.error).toBe("SAVED_QUERY_ALREADY_EXISTS");

    const preservada = await request(app).get(`/api/saved-queries/${segunda.body.id}`).set(auth(c.ownerA));
    expect(preservada.body.queryString).toBe("slaState=BREACHED");
    expect(primeira.body.id).not.toBe(segunda.body.id);
  });

  it("SQ-12 serializa POSTs concorrentes do mesmo dono para uma query canônica", async () => {
    const respostas = await Promise.all([
      salvar(c.ownerA, { name: "Concorrente A", queryString: "status=OPEN&severity=HIGH" }),
      salvar(c.ownerA, { name: "Concorrente B", queryString: "severity=HIGH&status=OPEN" }),
    ]);

    expect(respostas.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(respostas.find((r) => r.status === 409)?.body.error).toBe("SAVED_QUERY_ALREADY_EXISTS");
    expect(await prisma.savedQuery.count({ where: { ownerId: c.ownerAId } })).toBe(1);
  });

  it("SQ-13 serializa PUTs concorrentes e rejeita colisão de query canônica", async () => {
    const primeira = await salvar(c.ownerA, { name: "Primeira", queryString: "severity=HIGH" });
    const segunda = await salvar(c.ownerA, { name: "Segunda", queryString: "severity=LOW" });
    const respostas = await Promise.all([
      request(app)
        .put(`/api/saved-queries/${primeira.body.id}`)
        .set(auth(c.ownerA))
        .send({ queryString: "status=OPEN&severity=CRITICAL" }),
      request(app)
        .put(`/api/saved-queries/${segunda.body.id}`)
        .set(auth(c.ownerA))
        .send({ queryString: "severity=CRITICAL&status=OPEN" }),
    ]);

    expect(respostas.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(respostas.find((r) => r.status === 409)?.body.error).toBe("SAVED_QUERY_ALREADY_EXISTS");
    expect(await prisma.savedQuery.count({ where: { ownerId: c.ownerAId, queryString: "severity=CRITICAL&status=OPEN" } })).toBe(1);
  });

  it("SQ-09 a watchlist reexecuta com o escopo de quem abre", async () => {
    // Dois findings na empresa A: um no projeto do PENTESTER, outro fora dele.
    const appA2 = await seedApplication({ name: "App A2", companyId: c.companyAId });
    const projetoSemMembro = await seedProject({
      name: "Proj sem membro", applicationId: appA2.id, companyId: c.companyAId,
    });
    await seedVulnerability({
      projectId: c.projectAId, applicationId: c.appAId, companyId: c.companyAId,
      createdBy: c.pentesterId, title: "No projeto do pentester", severityCalculated: "CRITICAL",
    });
    await seedVulnerability({
      projectId: projetoSemMembro.id, applicationId: appA2.id, companyId: c.companyAId,
      createdBy: c.pentesterId, title: "Fora do projeto dele", severityCalculated: "CRITICAL",
    });

    const watchlist = await salvar(c.ownerA, {
      name: "Críticas da empresa",
      queryString: "severity=CRITICAL",
      scope: "COMPANY",
    });
    expect(watchlist.status).toBe(201);

    // 🎯 A MESMA query, executada por dois papéis diferentes.
    const executar = async (token: string) => {
      const res = await request(app).get(`/api/vulnerabilities?${watchlist.body.queryString}`).set(auth(token));
      expect(res.status).toBe(200);
      return (res.body.data as Array<{ title: string }>).map((v) => v.title).sort();
    };

    // O CLIENT da empresa vê os dois (RN16: tudo da empresa dele).
    expect(await executar(c.ownerA)).toEqual(["Fora do projeto dele", "No projeto do pentester"]);
    // O PENTESTER vê só o do projeto de que é membro (RN17) — mesma pergunta,
    // resposta diferente. Um snapshot teria mostrado os dois para ele.
    expect(await executar(c.pentester)).toEqual(["No projeto do pentester"]);
  });

  it("SQ-10 a query salva não é passe de acesso", async () => {
    await seedVulnerability({
      projectId: c.projectAId, applicationId: c.appAId, companyId: c.companyAId,
      createdBy: c.pentesterId, title: "Da empresa A", severityCalculated: "HIGH",
    });

    // B salva uma busca apontando para a empresa A. Salvar é permitido: é só
    // uma pergunta, e o id de empresa é um valor válido.
    const daB = await salvar(c.ownerB, {
      name: "Espiando a A",
      queryString: `companyId=${c.companyAId}&severity=HIGH`,
    });
    expect(daB.status).toBe(201);
    expect(daB.body.queryString).toContain(c.companyAId);

    // Mas executá-la não entrega nada: quem recorta é a listagem, não a busca.
    const res = await request(app).get(`/api/vulnerabilities?${daB.body.queryString}`).set(auth(c.ownerB));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  it("TEN-34 canário de tenancy das buscas salvas", async () => {
    const privadaA = await salvar(c.ownerA, { name: "Privada A", queryString: "status=OPEN" });
    const companyA = await salvar(c.ownerA, { name: "Time A", queryString: "status=FIXED", scope: "COMPANY" });
    const privadaB = await salvar(c.ownerB, { name: "Privada B", queryString: "status=OPEN" });
    const companyB = await salvar(c.ownerB, { name: "Time B", queryString: "status=FIXED", scope: "COMPANY" });

    const idsDe = async (token: string): Promise<string[]> => {
      const r = await request(app).get("/api/saved-queries").set(auth(token));
      expect(r.status).toBe(200);
      return (r.body as Array<{ id: string }>).map((q) => q.id).sort();
    };

    expect(await idsDe(c.ownerA)).toEqual([privadaA.body.id, companyA.body.id].sort());
    expect(await idsDe(c.ownerB)).toEqual([privadaB.body.id, companyB.body.id].sort());
    // O colega da empresa A vê a watchlist do time e NENHUMA privada alheia.
    expect(await idsDe(c.ownerA2)).toEqual([companyA.body.id]);

    // O ADMIN enxerga as watchlists das duas empresas (ele opera todas), e
    // nenhuma busca privada de terceiros.
    const doAdmin = await idsDe(c.admin);
    expect(doAdmin).toEqual([companyA.body.id, companyB.body.id].sort());
    expect(doAdmin).not.toContain(privadaA.body.id);
    expect(doAdmin).not.toContain(privadaB.body.id);

    // E o banco confirma que a empresa foi gravada a partir do usuário, nunca do corpo.
    const persistida = await prisma.savedQuery.findUniqueOrThrow({ where: { id: companyA.body.id } });
    expect(persistida.companyId).toBe(c.companyAId);
    expect(persistida.ownerId).toBe(c.ownerAId);
  });
});
